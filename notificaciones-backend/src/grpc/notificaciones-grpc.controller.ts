// notificaciones-backend/src/grpc/notificaciones-grpc.controller.ts
import { Controller, Logger }    from '@nestjs/common';
import { GrpcMethod }            from '@nestjs/microservices';
import { PrismaService }         from '../prisma/prisma.service.js';
import { NotificationsService }  from '../notifications/notifications.service.js';

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
    private readonly prisma:   PrismaService,
    private readonly notifSvc: NotificationsService,
  ) {}

  @GrpcMethod('NotificacionesService', 'SendNotification')
  async sendNotification(req: SendNotificationRequest) {
    const channel = CHANNEL_MAP[req.channel];
    if (!channel) {
      return { notificationId: '', status: 0, message: `Canal desconocido: ${req.channel}` };
    }
    try {
      const payload = JSON.parse(req.payloadJson) as Record<string, unknown>;
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
      await this.prisma.contactPreference.upsert({
        where: {
          organizationId_contactId_channel: {
            organizationId: req.organizationId,
            contactId:      req.contactId,
            channel,
          },
        },
        update: { optedOut: req.optedOut, optedOutAt: req.optedOut ? new Date() : null },
        create: {
          ecosystemId:    req.ecosystemId,
          organizationId: req.organizationId,
          contactId:      req.contactId,
          channel,
          optedOut:       req.optedOut,
          optedOutAt:     req.optedOut ? new Date() : null,
        },
      });
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
