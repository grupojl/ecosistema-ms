// chatia-backend/src/infrastructure/prisma/repositories/prisma-messages.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type { Message } from '@/generated/prisma/client.js';
import type {
  IMessagesRepository,
  MessageStats,
} from '@/core/messages/repository/messages.repository.interface.js';

@Injectable()
export class PrismaMessagesRepository implements IMessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async conversationBelongsTo(
    conversationId: string,
    organizationId: string,
  ): Promise<boolean> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, channelAccount: { organizationId } },
      select: { id: true },
    });
    return conversation !== null;
  }

  async listByConversation(
    conversationId: string,
    skip: number,
    take: number,
  ): Promise<{ messages: Message[]; total: number }> {
    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);
    return { messages, total };
  }

  async statsForOrganization(organizationId: string): Promise<MessageStats> {
    const accounts = await this.prisma.channelAccount.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const conversations = await this.prisma.conversation.findMany({
      where: { channelAccountId: { in: accounts.map((a) => a.id) } },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);
    const scope = { conversationId: { in: conversationIds } };

    const [total, inbound, outbound, aiGenerated, tokensSum] =
      await Promise.all([
        this.prisma.message.count({ where: scope }),
        this.prisma.message.count({
          where: { ...scope, direction: 'INBOUND' },
        }),
        this.prisma.message.count({
          where: { ...scope, direction: 'OUTBOUND' },
        }),
        this.prisma.message.count({
          where: { ...scope, isAiGenerated: true },
        }),
        this.prisma.message.aggregate({
          where: scope,
          _sum: { tokensUsed: true },
        }),
      ]);

    return {
      total,
      inbound,
      outbound,
      aiGenerated,
      totalTokensUsed: tokensSum._sum.tokensUsed ?? 0,
    };
  }
}
