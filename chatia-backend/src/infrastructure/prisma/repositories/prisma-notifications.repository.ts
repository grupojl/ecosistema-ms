// chatia-backend/src/infrastructure/prisma/repositories/prisma-notifications.repository.ts
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type { Notification, Prisma } from '@/generated/prisma/client.js';
import type {
  CreateNotificationData,
  INotificationsRepository,
} from '@/core/notifications/repository/notifications.repository.interface.js';

@Injectable()
export class PrismaNotificationsRepository implements INotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateNotificationData): Promise<Notification> {
    return this.prisma.notification.create({
      data: { id: randomUUID(), ...data },
    });
  }

  async listForAgent(
    agentId: string,
    onlyUnread: boolean,
    skip: number,
    take: number,
  ): Promise<{ rows: Notification[]; total: number; unreadCount: number }> {
    const where: Prisma.NotificationWhereInput = {
      agentId,
      ...(onlyUnread && { isRead: false }),
    };
    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { agentId, isRead: false } }),
    ]);
    return { rows, total, unreadCount };
  }

  async markRead(notificationId: string, agentId: string): Promise<number> {
    const res = await this.prisma.notification.updateMany({
      where: { id: notificationId, agentId },
      data: { isRead: true },
    });
    return res.count;
  }

  async markAllRead(agentId: string): Promise<number> {
    const res = await this.prisma.notification.updateMany({
      where: { agentId, isRead: false },
      data: { isRead: true },
    });
    return res.count;
  }
}
