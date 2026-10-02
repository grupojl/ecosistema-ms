// notificaciones-backend/src/notifications/repository/prisma-notifications.repository.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service.js";
import type {
  INotificationsRepository, NotificationRecord, StatsQuery, ChannelStats,
} from "@/notifications/repository/notifications.repository.interface.js";

@Injectable()
export class PrismaNotificationsRepository implements INotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<NotificationRecord | null> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    return row as NotificationRecord | null;
  }

  async getStats(query: StatsQuery): Promise<ChannelStats[]> {
    const where = {
      ecosystemId:    query.ecosystemId,
      organizationId: query.organizationId,
      createdAt:      { gte: query.from, lte: query.to },
      ...(query.channel && { channel: query.channel }),
    };
    const grouped = await this.prisma.notification.groupBy({
      by: ["channel", "status"], where, _count: { _all: true },
    });
    const byChannel: Record<string, {
      total: number; sent: number; failed: number; skipped: number; pending: number;
    }> = {};
    for (const row of grouped) {
      const ch = row.channel as string;
      if (!byChannel[ch]) byChannel[ch] = { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0 };
      const count  = row._count._all;
      const status = (row.status as string).toLowerCase() as keyof typeof byChannel[string];
      byChannel[ch]!.total += count;
      if (status in byChannel[ch]!) {
        (byChannel[ch]! as Record<string, number>)[status] = count;
      }
    }
    return Object.entries(byChannel).map(([channel, counts]) => ({
      channel, ...counts,
      deliveryRate: counts.total > 0
        ? Math.round((counts.sent / counts.total) * 1_000) / 10 : 0,
    }));
  }
}
