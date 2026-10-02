// notificaciones-backend/src/core/notifications/domain/notification-template.types.ts
// El core conoce IDs y datos de template — nunca el motor de renderizado.

export enum TemplateId {
  WELCOME             = "welcome",
  PAYMENT_CONFIRMED   = "payment-confirmed",
  ALERT               = "alert",
  CUSTOM              = "custom",
}

export interface TemplateData {
  recipientName?:  string;
  organizationId?: string;
  [key: string]:   unknown;
}
