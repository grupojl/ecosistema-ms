// notificaciones-backend/src/notifications/domain/notification.errors.ts
export abstract class NotificationDomainError extends Error {
  constructor(message: string) { super(message); this.name = this.constructor.name; }
}
export class NotificationNotFoundError extends NotificationDomainError {
  constructor(id: string) { super(`Notificación ${id} no encontrada`); }
}
export class UnsupportedChannelError extends NotificationDomainError {
  constructor(channel: string) { super(`Canal no soportado: ${channel}`); }
}
export type NotificationChannel = "WHATSAPP" | "EMAIL" | "PUSH";
const VALID_CHANNELS: NotificationChannel[] = ["WHATSAPP", "EMAIL", "PUSH"];
export function assertValidChannel(channel: string): asserts channel is NotificationChannel {
  if (!VALID_CHANNELS.includes(channel as NotificationChannel)) {
    throw new UnsupportedChannelError(channel);
  }
}
