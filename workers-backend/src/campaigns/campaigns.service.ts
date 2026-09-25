// workers-backend/src/campaigns/campaigns.service.ts
//
// FIX-03: refactorizado para usar ICampaignsRepository.
//
// EXCEPCIONES DOCUMENTADAS (mismo patrón que OrdersService en welver):
//   - dispatchCampaign():  usa PrismaService para la operación multi-tabla
//     (campaign.update + campaignRecipient.findMany + campaign.findUniqueOrThrow).
//     La atomicidad del dispatch no puede ir al repository sin Prisma.TransactionClient.
//   - addRecipients():     usa PrismaService para campaignRecipient.createMany
//     y campaign.update (actualiza contador). Multi-tabla sin transacción explícita.
//   - getStats():          usa PrismaService para campaignRecipient.groupBy.
//     El groupBy es una agregación que no está en ICampaignsRepository.
// Scope S5: cuando ICampaignsRepository soporte addRecipients + getStats,
//           se completa la migración.
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue }                            from '@nestjs/bullmq';
import { Cron }                                   from '@nestjs/schedule';
import { InjectRedis }                            from '@nestjs-modules/ioredis';
import { Inject }                                 from '@nestjs/common';
import { Queue }                                  from 'bullmq';
import Redis                                      from 'ioredis';
import { PrismaService }                          from '@/prisma/prisma.service.js';
import { WORKER_QUEUES }                          from '@/jobs/jobs.constants.js';
import {
  CAMPAIGNS_REPOSITORY,
  type ICampaignsRepository,
} from '@/campaigns/repository/campaigns.repository.interface.js';
import { assertValidCampaignTransition } from '@/campaigns/domain/campaign.errors.js';
import type { CreateCampaignDto, PatchCampaignDto } from '@/campaigns/dto/campaign.dto.js';

const SCHEDULER_LOCK_KEY = 'workers:scheduler:campaigns';
const SCHEDULER_LOCK_TTL = 55;
const MAX_DISPATCH_PER_CYCLE = 20;

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    // Excepción documentada: dispatchCampaign, addRecipients, getStats usan $prisma
    private readonly prisma: PrismaService,
    @Inject(CAMPAIGNS_REPOSITORY)
    private readonly campaignsRepository: ICampaignsRepository,
    @InjectQueue(WORKER_QUEUES.CAMPAIGN_EMAIL) private readonly queue: Queue,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ── CRUD — via repository ─────────────────────────────────────────────────

  async create(dto: CreateCampaignDto) {
    return this.campaignsRepository.create({
      ecosystemId:    dto.ecosystemId,
      organizationId: dto.organizationId,
      templateKey:    dto.templateKey,
      scheduledAt:    dto.scheduledAt,
    });
  }

  async findAll(organizationId: string, status?: string) {
    return this.campaignsRepository.findAll(organizationId, status);
  }

  async findOne(id: string, organizationId: string) {
    const campaign = await this.campaignsRepository.findById(id, organizationId);
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async patch(id: string, organizationId: string, dto: PatchCampaignDto) {
    await this.findOne(id, organizationId); // throws si no existe
    return this.campaignsRepository.update(id, {
      status:      dto.status,
      scheduledAt: dto.scheduledAt,
    });
  }

  async cancel(id: string, organizationId: string) {
    const campaign = await this.findOne(id, organizationId);
    assertValidCampaignTransition(campaign.status as never // @ecosistema-ms/jsonb-cast, 'CANCELLED');

    // Cancelar jobs pendientes en BullMQ
    const jobs = await this.queue.getJobs(['waiting', 'delayed']);
    const toCancel = jobs.filter(j => j.data?.campaignId === id);
    await Promise.allSettled(toCancel.map(j => j.remove()));

    return this.campaignsRepository.update(id, { status: 'CANCELLED' });
  }

  // ── Scheduler — excepción documentada: usa this.prisma ───────────────────
  @Cron('* * * * *')
  async dispatchScheduledCampaigns(): Promise<void> {
    const lock = await this.redis.set(
      SCHEDULER_LOCK_KEY, '1', 'EX', SCHEDULER_LOCK_TTL, 'NX',
    );
    if (!lock) return;

    try {
      // findDueScheduled sí va por el repository
      const due = await this.campaignsRepository.findDueScheduled(MAX_DISPATCH_PER_CYCLE);
      for (const campaign of due) {
        await this.dispatchCampaign(campaign.id).catch(err =>
          this.logger.error({ err, campaignId: campaign.id }, 'dispatch failed'),
        );
      }
    } finally {
      await this.redis.del(SCHEDULER_LOCK_KEY).catch(() => {});
    }
  }

  // Excepción: usa PrismaService — multi-tabla sin tx explícita
  async dispatchCampaign(campaignId: string): Promise<void> {
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data:  { status: 'RUNNING', startedAt: new Date() },
    });

    const recipients = await this.prisma.campaignRecipient.findMany({
      where:  { campaignId, status: 'PENDING' },
      select: { id: true, contactId: true, email: true },
    });

    if (recipients.length === 0) {
      this.logger.warn({ campaignId }, 'campaign has no pending recipients — marking COMPLETED');
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data:  { status: 'COMPLETED', completedAt: new Date() },
      });
      return;
    }

    const campaign = await this.prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
    });

    await this.queue.add(
      'send-campaign',
      {
        campaignId,
        ecosystemId:    campaign.ecosystemId,
        organizationId: campaign.organizationId,
        templateKey:    campaign.templateKey,
        recipientIds:   recipients.map(r => r.contactId),
        recipientCount: recipients.length,
      },
      {
        jobId:            `campaign:${campaignId}`,
        attempts:         3,
        backoff:          { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 50 },
        removeOnFail:     { count: 100 },
      },
    );
    this.logger.log({ campaignId, recipientCount: recipients.length }, 'campaign dispatched');
  }

  // ── Recipients — excepción: usa PrismaService (multi-tabla) ──────────────
  async addRecipients(
    campaignId:     string,
    organizationId: string,
    recipients:     Array<{ contactId: string; email?: string }>,
  ) {
    await this.findOne(campaignId, organizationId);

    const result = await this.prisma.campaignRecipient.createMany({
      data: recipients.map(r => ({
        campaignId,
        contactId: r.contactId,
        email:     r.email,
      })),
      skipDuplicates: true,
    });

    const total = await this.prisma.campaignRecipient.count({ where: { campaignId } });
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data:  { totalRecipients: total },
    });

    return result;
  }

  // Excepción: groupBy no está en ICampaignsRepository (scope S5)
  async getStats(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.campaignRecipient.groupBy({
      by:    ['status'],
      where: { campaignId: id },
      _count: { status: true },
    });
  }
}
