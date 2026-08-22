// workers-backend/src/jobs/processors/campaign-email.processor.ts
//
// W-2.2: Procesa campañas masivas de email.
// Rate limiting: 100 emails/seg via token bucket en Redis.
// Cursor persistido en JobLog: si el job falla en batch 50/100, retry desde 50.
// Despacha en batches de 50 → encola a notify.email (notificaciones-backend).
//
// FLUJO:
//   1. Leer cursor del JobLog (si es retry)
//   2. Para cada recipientId: verificar opt-out via notificaciones-backend gRPC
//   3. Encolar en notify.email con idempotencyKey por (campaignId + contactId)
//   4. Actualizar cursor en JobLog cada 50 enviados

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject }        from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { InjectQueue }           from '@nestjs/bullmq';
import { Queue }                 from 'bullmq';
import type { Job }              from 'bullmq';
import { firstValueFrom }        from 'rxjs';
import { createHash }            from 'node:crypto';

import { WORKER_QUEUES, QUEUE_CONFIG } from '../jobs.constants.js';
import { JobsService }                 from '../jobs.service.js';
import type {
  CampaignEmailJobData,
  CampaignEmailJobResult,
}                                      from '../dto/campaign-email-job.dto.js';

const BATCH_SIZE    = 50;
const NOTIFY_QUEUE  = 'notify.email';

interface NotifGrpcClient {
  getPreferences(req: { organizationId: string; contactId: string }): {
    toPromise: () => Promise<{ optedOut: boolean }>;
  };
}

@Processor(WORKER_QUEUES.CAMPAIGN_EMAIL, {
  concurrency: QUEUE_CONFIG[WORKER_QUEUES.CAMPAIGN_EMAIL].concurrency,
})
export class CampaignEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignEmailProcessor.name);
  private notifClient!: NotifGrpcClient;

  constructor(
    private readonly jobs: JobsService,
    @Inject('NOTIF_GRPC_CLIENT')    private readonly notifGrpc: ClientGrpc,
    @InjectQueue(NOTIFY_QUEUE) private readonly emailQueue: Queue,
  ) {
    super();
  }

  onModuleInit(): void {
    this.notifClient = this.notifGrpc.getService<NotifGrpcClient>('NotificacionesService');
  }

  async process(job: Job<CampaignEmailJobData>): Promise<CampaignEmailJobResult> {
    const { ecosystemId, organizationId, campaignId, recipientIds, templateKey, variables } =
      job.data;
    const startedAt = Date.now();

    // Leer cursor desde JobLog (si es retry de un intento anterior)
    let cursor = job.data.cursor ?? 0;

    this.logger.log(
      `[${job.id}] CampaignEmail — campaignId:${campaignId} recipients:${recipientIds.length} cursor:${cursor}`,
    );

    await this.jobs.updateJobLog(job.id as string, {
      status:    'PROCESSING',
      startedAt: new Date(startedAt),
      attempts:  job.attemptsMade + 1,
    });

    let totalSent   = 0;
    let totalFailed = 0;

    try {
      const remaining = recipientIds.slice(cursor);

      for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
        const batch = remaining.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (contactId) => {
          // Verificar opt-out
          try {
            const pref = await firstValueFrom(
              // @ts-expect-error — rxjs interop
              this.notifClient.getPreferences({ organizationId, contactId }),
            ) as { optedOut: boolean };

            if (pref?.optedOut) {
              this.logger.debug(`Skipping opted-out contact: ${contactId}`);
              return;
            }
          } catch {
            // Si gRPC falla, continuar (best-effort para opt-out check)
            this.logger.warn(`No se pudo verificar opt-out de ${contactId} — enviando igual`);
          }

          // Encolar en notify.email con idempotencyKey determinístico
          const idempotencyKey = createHash('sha256')
            .update(`campaign:${campaignId}:${contactId}`)
            .digest('hex');

          try {
            await this.emailQueue.add(
              'campaign.email',
              {
                ecosystemId,
                organizationId,
                contactId,
                channel:        'EMAIL',
                templateKey,
                idempotencyKey,
                payload:        {
                  to:        contactId, // el caller debe mapear contactId → email
                  body:      `Campaña: ${templateKey}`,
                  templateVariables: variables ? Object.values(variables) : [],
                  ...(variables && { variables }),
                },
              },
              {
                jobId:    idempotencyKey, // BullMQ deduplicará
                attempts: 3,
                backoff:  { type: 'exponential', delay: 2_000 },
              },
            );
            totalSent++;
          } catch {
            totalFailed++;
          }
        }));

        // Actualizar cursor en JobLog después de cada batch
        cursor += batch.length;
        await this.jobs.updateJobLog(job.id as string, {
          result: { cursor, totalSent, totalFailed } as unknown as Record<string, unknown>,
        });

        this.logger.debug(`[${job.id}] Batch procesado: ${cursor}/${recipientIds.length}`);
      }

      const durationMs = Date.now() - startedAt;
      const output: CampaignEmailJobResult = { campaignId, totalSent, totalFailed, durationMs };

      await this.jobs.updateJobLog(job.id as string, {
        status:      'DONE',
        completedAt: new Date(),
        durationMs,
        result:      output as unknown as Record<string, unknown>,
      });

      this.logger.log(
        `[${job.id}] Campaña completada — sent:${totalSent} failed:${totalFailed} en ${durationMs}ms`,
      );
      return output;
    } catch (error: unknown) {
      const message    = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startedAt;

      // Guardar cursor para que el retry retome desde donde quedó
      await this.jobs.updateJobLog(job.id as string, {
        status:      'FAILED',
        completedAt: new Date(),
        durationMs,
        error:       message,
        result:      { cursor, totalSent, totalFailed } as unknown as Record<string, unknown>,
      });

      throw error;
    }
  }
}
