// notificaciones-backend/src/notifications/repository/notifications.repository.interface.ts
export const NOTIFICATIONS_REPOSITORY = Symbol("NOTIFICATIONS_REPOSITORY");

export interface NotificationRecord {
  id:             string;
  ecosystemId:    string;
  organizationId: string;
  contactId:      string;
  channel:        string;
  status:         string;
  attempts:       number;
  sentAt:         Date | null;
  failureReason:  string | null;
  createdAt:      Date;
}

export interface StatsQuery {
  ecosystemId:    string;
  organizationId: string;
  from:           Date;
  to:             Date;
  channel?:       "WHATSAPP" | "EMAIL" | "PUSH";
}

export interface ChannelStats {
  channel:      string;
  total:        number;
  sent:         number;
  failed:       number;
  skipped:      number;
  pending:      number;
  deliveryRate: number;
}

export interface INotificationsRepository {
  findById(id: string): Promise<NotificationRecord | null>;
  getStats(query: StatsQuery): Promise<ChannelStats[]>;
}
