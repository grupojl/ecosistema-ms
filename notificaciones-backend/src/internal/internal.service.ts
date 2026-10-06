import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }        from '@/prisma/prisma.service';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const since = new Date(Date.now() - 60 * 60 * 1000); // última hora

    const [sent, failed, pending] = await Promise.all([
      this.prisma.notification.count({
        where: { status: 'SENT', createdAt: { gte: since } },
      }),
      this.prisma.notification.count({
        where: { status: 'FAILED', createdAt: { gte: since } },
      }),
      this.prisma.notification.count({
        where: { status: 'PENDING' },
      }),
    ]);

    return {
      status: 'ok' as const,
      notifications: {
        sentLast1h:  sent,
        failedLast1h: failed,
        pendingNow:  pending,
      },
      uptime: Math.floor(process.uptime()),
    };
  }
}
