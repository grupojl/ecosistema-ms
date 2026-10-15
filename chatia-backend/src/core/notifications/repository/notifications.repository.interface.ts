// chatia-backend/src/core/notifications/repository/notifications.repository.interface.ts
import type {
  Notification,
  NotificationType,
} from '@/generated/prisma/client.js';

export const NOTIFICATIONS_REPOSITORY = Symbol('NOTIFICATIONS_REPOSITORY');

export interface CreateNotificationData {
  organizationId: string;
  agentId: string;
  conversationId: string | null;
  type: NotificationType;
  title: string;
  body: string;
}

export interface INotificationsRepository {
  create(data: CreateNotificationData): Promise<Notification>;
  /** Página de notificaciones del agente + total del filtro + no leídas totales. */
  listForAgent(
    agentId: string,
    onlyUnread: boolean,
    skip: number,
    take: number,
  ): Promise<{ rows: Notification[]; total: number; unreadCount: number }>;
  /** Marca una notificación del agente como leída. Devuelve cuántas filas cambió (0 si no era suya). */
  markRead(notificationId: string, agentId: string): Promise<number>;
  markAllRead(agentId: string): Promise<number>;
}
