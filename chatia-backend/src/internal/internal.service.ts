import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }       from '@/prisma/prisma.service';
import type { ListConversationsDto } from '@/internal/schemas';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listConversations(dto: ListConversationsDto) {
    const where = {
      ecosystemId:    dto.ecosystemId,
      ...(dto.organizationId ? { organizationId: dto.organizationId } : {}),
      ...(dto.status          ? { status: dto.status }                 : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        select: {
          id:             true,
          ecosystemId:    true,
          organizationId: true,
          status:         true,
          channel:        true,
          createdAt:      true,
          updatedAt:      true,
          assignedAgentId: true,
        },
        orderBy: { createdAt: 'desc' },
        skip:  (dto.page - 1) * dto.limit,
        take:  dto.limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { data, total, page: dto.page, limit: dto.limit };
  }

  async getHealth() {
    const [open, escalated, resolved] = await Promise.all([
      this.prisma.conversation.count({ where: { status: { notIn: ['RESUELTO'] } } }),
      this.prisma.conversation.count({ where: { status: 'ESCALADO' } }),
      this.prisma.conversation.count({ where: { status: 'RESUELTO' } }),
    ]);

    return {
      status:  'ok' as const,
      conversations: { open, escalated, resolved },
      uptime:  Math.floor(process.uptime()),
    };
  }
}
