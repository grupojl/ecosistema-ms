// workers-backend/src/campaigns/campaigns.service.ts
//
// W-2.3: CRUD de campañas + scheduler.
// El @Cron corre cada minuto y encola campañas con scheduledAt <= now.
// Lock distribuido en Redis para evitar doble ejecución en instancias múltiples.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue }                            from '@nestjs/bullmq';
import { Cron }                                   from '@nestjs/schedule';
import { Queue }                                  from 'bullmq';
import { PrismaService }                          from '../prisma/prisma.service.js';
import { WORKER_QUEUES }                          from '../jobs/jobs.constants.js';
import type { CreateCampaignDto, PatchCampaignDto } from './dto/campaign.dto.js';

const SCHEDULER_LOCK_KEY = 'workers:campaign-scheduler:lock';
const LOCK_TTL_MS        = 55_000; // 55s — un poco menos que el cron interval

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WORKER_QUEUES.CAMPAIGN_EMAIL) private readonly campaignQueue: Queue,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(dto: CreateCampaignDto) {
    const campaign = await this.prisma.campaign.create({
      data: {
        ecosystemId:    dto.ecosystemId,
        organizationId: dto.organizationId,
        templateKey:    dto.templateKey,
        status:         dto.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt:    dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        totalRecipients: dto.recipientIds.length,
      },
    });

    this.logger.log(`Campaign creada: ${campaign.id} status:${campaign.status}`);
    return campaign;
  }

  async findAll(organizationId: string, status?: string) {
    return this.prisma.campaign.findMany({
      where: {
        organizationId,
        ...(status && { status: status as 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' }),
      },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
  }

  async findOne(id: string, organizationId: string) {
    const c = await this.prisma.campaign.findFirst({
      where: { id, organizationId },
    });
    if (!c) throw new NotFoundException(`Campaign ${id} no encontrada`);
    return c;
  }

  async patch(id: string, organizationId: string, dto: PatchCampaignDto) {
    await this.findOne(id, organizationId); // throws si no existe

    if (dto.status === 'PAUSED') {
      // Cancelar jobs pendientes en BullMQ
      const jobs = await this.campaignQueue.getJobs(['waiting', 'delayed']);
      const toCancel = jobs.filter(j => (j.data as { campaignId?: string })?.campaignId === id);
      await Promise.all(toCancel.map(j => j.remove()));
      this.logger.log(`Campaign ${id} pausada — ${toCancel.length} jobs cancelados`);
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.status      && { status: dto.status }),
        ...(dto.scheduledAt && { scheduledAt: new Date(dto.scheduledAt) }),
      },
    });
  }

  // ── Scheduler ──────────────────────────────────────────────────────────────

  /**
   * Corre cada minuto. Despacha campañas con scheduledAt <= now.
   * Lock distribuido: si otra instancia ya está corriendo, se saltea.
   */
  @Cron('* * * * *') // cada minuto
  async dispatchScheduledCampaigns(): Promise<void> {
    // Intentar obtener lock (usando BullMQ Queue como proxy de Redis)
    // Lock simplificado: si el job "scheduler-lock" ya existe en la queue, saltar
    const lockJob = await this.campaignQueue.getJob(SCHEDULER_LOCK_KEY);
    if (lockJob) return; // otro pod ya está corriendo

    try {
      // Crear lock temporal
      await this.campaignQueue.add(
        'scheduler-lock',
        {},
        { jobId: SCHEDULER_LOCK_KEY, delay: LOCK_TTL_MS, removeOnComplete: true },
      );

      const due = await this.prisma.campaign.findMany({
        where: {
          status:      'SCHEDULED',
          scheduledAt: { lte: new Date() },
        },
        take: 20, // máx 20 por ciclo para no bloquear
      });

      if (due.length === 0) return;

      this.logger.log(`Scheduler: ${due.length} campañas para despachar`);

      for (const campaign of due) {
        await this.dispatchCampaign(campaign.id);
      }
    } catch (e: unknown) {
      this.logger.error(`Scheduler error: ${String(e)}`);
    }
  }

  async dispatchCampaign(campaignId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) return;

    // Actualizar estado a RUNNING
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data:  { status: 'RUNNING', startedAt: new Date() },
    });

    // Encolar el job de campaña
    // NOTA: recipientIds no está en el modelo Campaign (es un input del create).
    // En producción: persistir recipientIds en tabla CampaignRecipient.
    // Por ahora: loguear y marcar como pendiente de implementación.
    this.logger.warn(
      `Campaign ${campaignId} despachada — implementar CampaignRecipient para persistir recipients`,
    );

    await this.campaignQueue.add(
      'campaign.email',
      {
        ecosystemId:    campaign.ecosystemId,
        organizationId: campaign.organizationId,
        campaignId:     campaign.id,
        recipientIds:   [], // TODO: leer de CampaignRecipient
        templateKey:    campaign.templateKey,
      },
      {
        jobId:    `campaign:${campaign.id}`,
        attempts: 3,
        backoff:  { type: 'exponential', delay: 5_000 },
      },
    );
  }
}
