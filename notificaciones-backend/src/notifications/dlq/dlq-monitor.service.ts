// notificaciones-backend/src/notifications/dlq/dlq-monitor.service.ts
//
// N-3.3: Monitorea la DLQ de notificaciones.
// Si supera el threshold configurable → notifica al OWNER de la org via gRPC a chatia.
//
// Estrategia: @Cron cada 5 minutos revisa tamaño de DLQ.
// No usamos evento on('failed') de BullMQ porque queremos threshold, no por-job.

import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression }                      from '@nestjs/schedule';
import { InjectQueue }                               from '@nestjs/bullmq';
import { Queue }                                     from 'bullmq';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom }                            from 'rxjs';
import { QUEUES }                                    from '../notifications.constants.js';

const DLQ_WARN_THRESHOLD  = 50;   // warning en log
const DLQ_ALERT_THRESHOLD = 100;  // alerta a chatia via gRPC

interface ChatiaNotifyRequest {
  organizationId: string;
  ecosystemId:    string;
  type:           string;
  title:          string;
  body:           string;
}

interface ChatiaInternalClient {
  notifySystem(req: ChatiaNotifyRequest): { toPromise: () => Promise<{ success: boolean }> };
}

@Injectable()
export class DlqMonitorService implements OnModuleInit {
  private readonly logger = new Logger(DlqMonitorService.name);
  private chatiaClient!: ChatiaInternalClient;

  constructor(
    @InjectQueue(QUEUES.DLQ) private readonly dlqQueue: Queue,
    @Inject('CHATIA_GRPC_CLIENT') private readonly grpc: ClientGrpc,
  ) {}

  onModuleInit(): void {
    // El servicio interno de chatia para notificaciones de sistema
    // Si no está disponible el método, falla silenciosamente
    try {
      this.chatiaClient = this.grpc.getService<ChatiaInternalClient>('ChatIaService');
    } catch {
      this.logger.warn('ChatiaGrpc no disponible — alertas DLQ deshabilitadas');
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkDlqSize(): Promise<void> {
    try {
      const size = await this.dlqQueue.getFailedCount();

      if (size === 0) return;

      if (size >= DLQ_ALERT_THRESHOLD) {
        this.logger.error(`DLQ CRÍTICA: ${size} notificaciones fallidas (threshold: ${DLQ_ALERT_THRESHOLD})`);
        await this.sendAlert(size);
      } else if (size >= DLQ_WARN_THRESHOLD) {
        this.logger.warn(`DLQ WARNING: ${size} notificaciones fallidas (threshold: ${DLQ_WARN_THRESHOLD})`);
      } else {
        this.logger.debug(`DLQ size: ${size}`);
      }
    } catch (e: unknown) {
      this.logger.error(`Error chequeando DLQ: ${String(e)}`);
    }
  }

  /**
   * Expuesto para que dlq.controller pueda forzar revisión manual.
   */
  async getDlqStats(): Promise<{ failed: number; waiting: number }> {
    const [failed, waiting] = await Promise.all([
      this.dlqQueue.getFailedCount(),
      this.dlqQueue.getWaitingCount(),
    ]);
    return { failed, waiting };
  }

  private async sendAlert(dlqSize: number): Promise<void> {
    if (!this.chatiaClient) return;

    try {
      await firstValueFrom(
        // @ts-expect-error — rxjs interop
        this.chatiaClient.notifySystem({
          // organizationId global del ecosistema para alertas de infraestructura
          organizationId: process.env['ECOSYSTEM_ORG_ID'] ?? 'system',
          ecosystemId:    process.env['ECOSYSTEM_ID']     ?? 'system',
          type:           'SYSTEM_ALERT',
          title:          '⚠️ DLQ de notificaciones crítica',
          body:           `${dlqSize} notificaciones fallidas acumuladas. Revisar DLQ en notificaciones-backend.`,
        }),
      );
      this.logger.log('Alerta DLQ enviada a chatia-backend');
    } catch (e: unknown) {
      this.logger.warn(`No se pudo enviar alerta DLQ a chatia: ${String(e)}`);
    }
  }
}
