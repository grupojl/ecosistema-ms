import { Controller, Logger } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PreferencesService } from "../preferences/preferences.service.js";
@Controller()
export class NotificacionesGrpcController {
  private readonly logger = new Logger(NotificacionesGrpcController.name);
  constructor(private readonly notifSvc: NotificationsService, private readonly prefSvc: PreferencesService) {}
  @GrpcMethod("NotificacionesService", "SendNotification")
  async sendNotification(data: { ecosystem_id:string; organization_id:string; contact_id:string; channel:string; template_key:string; idempotency_key:string; payload_json:Buffer }) {
    const result = await this.notifSvc.enqueue({ ecosystemId: data.ecosystem_id, organizationId: data.organization_id, contactId: data.contact_id, channel: data.channel as any, templateKey: data.template_key, payload: JSON.parse(data.payload_json.toString()), idempotencyKey: data.idempotency_key });
    return { notification_id: result.notificationId, status: result.status, message: "OK" };
  }
  @GrpcMethod("NotificacionesService", "UpdateContactPreference")
  async updateContactPreference(data: { ecosystem_id:string; organization_id:string; contact_id:string; channel:string; opted_out:boolean }) {
    await this.prefSvc.upsertPreference(data.ecosystem_id, data.organization_id, data.contact_id, data.channel as any, data.opted_out);
    return { success: true };
  }
  @GrpcMethod("NotificacionesService", "Ping")
  ping(data: { from: string }) { return { pong: "notificaciones-backend", timestamp_unix: Date.now() }; }
}
