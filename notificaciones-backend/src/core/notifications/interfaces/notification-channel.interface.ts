// notificaciones-backend/src/notifications/interfaces/notification-channel.interface.ts

export type NotificationChannelType = 'WHATSAPP' | 'EMAIL' | 'PUSH';

export interface SendPayload {
  to:                 string;
  body:               string;
  templateKey?:       string;
  templateVariables?: string[];
  language?:          string;
  subject?:           string;
  meta?:              Record<string, unknown>;
}

// Compatibilidad con contrato viejo (grpc controller)
export interface DispatchPayload {
  ecosystemId: string; organizationId: string; contactId: string;
  templateKey: string; data: Record<string, unknown>; channelData: Record<string, unknown>;
}
export interface DispatchResult { success: boolean; externalId?: string; failureReason?: string; }

export interface INotificationChannel {
  readonly channel: NotificationChannelType;
  isConfigured():   boolean;
  send(payload: SendPayload): Promise<void>;
}
