// notificaciones-backend/src/grpc/notificaciones-grpc.controller.ts
import { Controller, Logger }    from '@nestjs/common';
import { GrpcMethod }            from '@nestjs/microservices';
import { PreferencesService }  from '@/core/preferences/preferences.service.js';
import { NotificationsService }  from '@/core/notifications/notifications.service.js';

interface SendNotificationRequest {
  ecosystemId:    string;
  organizationId: string;
  contactId:      string;
  channel:        number;
  templateKey:    string;
  idempotencyKey: string;
  payloadJson:    string;
}

interface UpdatePreferenceRequest {
  ecosystemId:    string;
  organizationId: string;
  contactId:      string;
  channel:        number;
  optedOut:       boolean;
}

const CHANNEL_MAP: Record<number, 'WHATSAPP' | 'EMAIL' | 'PUSH'> = {
  1: 'WHATSAPP', 2: 'EMAIL', 3: 'PUSH',
};

@Controller()
export class NotificacionesGrpcController {
  private readonly logger = new Logger(NotificacionesGrpcController.name);

  constructor(
    private readonly prefsSvc: PreferencesService,
    private readonly notifSvc: NotificationsService,
  ) {}

  @GrpcMethod('NotificacionesService', 'SendNotification')
  async sendNotification(req: SendNotificationRequest) {
    const channel = CHANNEL_MAP[req.channel];
    if (!channel) {
      return { notificationId: '', status: 0, message: `Canal desconocido: ${req.channel}` };
    }
    try {
      let payload: Record<string, unknown>; try { payload = JSON.parse(req.payloadJson) as Record<string, unknown>; } catch { throw new Error('payloadJson invalido'); }
      // enqueue retorna { jobId, channel } — mapeamos al contrato gRPC
      const result  = await this.notifSvc.enqueue({
        ecosystemId:    req.ecosystemId,
        organizationId: req.organizationId,
        contactId:      req.contactId,
        channel,
        templateKey:    req.templateKey,
        idempotencyKey: req.idempotencyKey,
        payload,
      });
      return { notificationId: result.jobId, status: 2, message: 'queued' };
    } catch (e: unknown) {
      return { notificationId: '', status: 1, message: String(e) };
    }
  }

  @GrpcMethod('NotificacionesService', 'UpdateContactPreference')
  async updateContactPreference(req: UpdatePreferenceRequest) {
    const channel = CHANNEL_MAP[req.channel];
    if (!channel) return { success: false };
    try {
      await this.prefsSvc.upsertPreference(
        req.ecosystemId,
        req.organizationId,
        req.contactId,
        channel,
        req.optedOut,
      );
      return { success: true };
    } catch (e: unknown) {
      this.logger.error(`UpdatePreference error: ${String(e)}`);
      return { success: false };
    }
  }

  @GrpcMethod('NotificacionesService', 'Ping')
  ping(req: { from: string }) {
    return { pong: 'notificaciones-backend', timestampUnix: Date.now() };
  }
}
