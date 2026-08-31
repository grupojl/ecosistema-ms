// workers-backend/src/campaigns/campaigns.service.ts
//
// W-2.3: CRUD de campanas + scheduler.
// El @Cron corre cada minuto y encola campanas con scheduledAt <= now.
// Lock distribuido: SET NX EX sobre Redis (mismo patron que analytics projections).
// ADR-003: recipientIds ahora viene de CampaignRecipient en DB.
// ADR-006: lock con SET NX EX — no BullMQ como proxy.
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue }                            from '@nestjs/bullmq';
import { Cron }                                   from '@nestjs/schedule';
import { InjectRedis }                            from '@nestjs-modules/ioredis';
import { Queue }                                  from 'bullmq';
import Redis                                      from 'ioredis';
import { PrismaService }                          from '../prisma/prisma.service.js';
import { WORKER_QUEUES }                          from '../jobs/jobs.constants.js';
import type { CreateCampaignDto, PatchCampaignDto } from './dto/campaign.dto.js';

const SCHEDULER_LOCK_KEY = 'workers:scheduler:campaigns';
const SCHEDULER_LOCK_TTL = 55; // segundos — menos que el intervalo del cron (60s)
const MAX_DISPATCH_PER_CYCLE = 20;

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WORKER_QUEUES.CAMPAIGN_EMAIL) private readonly queue: Queue,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(dto: CreateCampaignDto) {
    return this.prisma.campaign.create({ data: dto });
  }

  async findAll(organizationId: string, status?: string) {
    return this.prisma.campaign.findMany({
      where: {
        organizationId,
        ...(status ? { status: status as any } : {}), // @ecosistema-ms/jsonb-cast — enum cast
      },
      include: { _count: { select: { recipients: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { recipients: true } } },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async patch(id: string, organizationId: string, dto: PatchCampaignDto) {
    await this.findOne(id, organizationId); // throws si no existe
    return this.prisma.campaign.update({ where: { id }, data: dto });
  }

  async cancel(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    // Cancelar jobs pendientes en BullMQ
    const jobs = await this.queue.getJobs(['waiting', 'delayed']);
    const toCancel = jobs.filter(j => j.data?.campaignId === id);
    await Promise.allSettled(toCancel.map(j => j.remove()));
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'FAILED' },
    });
  }

  // ── Scheduler ─────────────────────────────────────────────────────────────

  /**
   * Corre cada minuto. Despacha campanas con scheduledAt <= now.
   * Lock distribuido con SET NX EX sobre Redis — ADR-006.
   * Solo un pod corre el dispatch a la vez.
   */
  @Cron('* * * * *')
  async dispatchScheduledCampaigns(): Promise<void> {
    // SET NX EX — lock atomico. Si otro pod ya tiene el lock, retorna null.
    const lock = await this.redis.set(
      SCHEDULER_LOCK_KEY,
      '1',
      'EX', SCHEDULER_LOCK_TTL,
      'NX',
    );
    if (!lock) return; // otro pod esta corriendo el scheduler

    try {
      const due = await this.prisma.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: new Date() },
        },
        take: MAX_DISPATCH_PER_CYCLE,
        orderBy: { scheduledAt: 'asc' },
      });

      for (const campaign of due) {
        await this.dispatchCampaign(campaign.id).catch(err =>
          this.logger.error({ err, campaignId: campaign.id }, 'dispatch failed'),
        );
      }
    } finally {
      // Liberar el lock siempre — incluso si hubo error
      await this.redis.del(SCHEDULER_LOCK_KEY).catch(() => {});
    }
  }

  async dispatchCampaign(campaignId: string): Promise<void> {
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    // ADR-003: leer recipients reales de CampaignRecipient
    const recipients = await this.prisma.campaignRecipient.findMany({
      where: { campaignId, status: 'PENDING' },
      select: { id: true, contactId: true, email: true },
    });

    if (recipients.length === 0) {
      this.logger.warn({ campaignId }, 'campaign has no pending recipients — marking COMPLETED');
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() },
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

  // ── Recipients CRUD ────────────────────────────────────────────────────────

  async addRecipients(
    campaignId:    string,
    organizationId: string,
    recipients: Array<{ contactId: string; email?: string }>,
  ) {
    await this.findOne(campaignId, organizationId);
    // createMany ignora duplicados via skipDuplicates
    const result = await this.prisma.campaignRecipient.createMany({
      data: recipients.map(r => ({
        campaignId,
        contactId: r.contactId,
        email:     r.email,
      })),
      skipDuplicates: true,
    });
    // Actualizar contador
    const total = await this.prisma.campaignRecipient.count({ where: { campaignId } });
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data:  { totalRecipients: total },
    });
    return result;
  }

  async getStats(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.campaignRecipient.groupBy({
      by:    ['status'],
      where: { campaignId: id },
      _count: { status: true },
    });
  }
}
