// chatia-backend/src/infrastructure/prisma/repositories/prisma-privacy.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type {
  ContactIdentity,
  ErasedCounts,
  IPrivacyRepository,
} from '@/core/privacy/repository/privacy.repository.interface.js';

@Injectable()
export class PrismaPrivacyRepository implements IPrivacyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async deleteSessionsOlderThan(
    cutoff: Date,
    batchSize: number,
  ): Promise<number> {
    let deleted = 0;
    for (;;) {
      const old = await this.prisma.assistantSession.findMany({
        where: {
          OR: [
            { lastMessageAt: { lt: cutoff } },
            { lastMessageAt: null, createdAt: { lt: cutoff } },
          ],
        },
        select: { id: true },
        take: batchSize,
      });
      if (old.length === 0) break;
      const { count } = await this.prisma.assistantSession.deleteMany({
        where: { id: { in: old.map((s) => s.id) } },
      });
      deleted += count;
      if (old.length < batchSize) break;
    }
    return deleted;
  }

  async deleteMessagesOlderThan(
    cutoff: Date,
    batchSize: number,
  ): Promise<number> {
    let deleted = 0;
    for (;;) {
      const old = await this.prisma.message.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: batchSize,
      });
      if (old.length === 0) break;
      const { count } = await this.prisma.message.deleteMany({
        where: { id: { in: old.map((m) => m.id) } },
      });
      deleted += count;
      if (old.length < batchSize) break;
    }
    return deleted;
  }

  findContact(
    organizationId: string,
    contactId: string,
  ): Promise<ContactIdentity | null> {
    return this.prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      select: { id: true, externalId: true },
    });
  }

  async eraseContact(
    organizationId: string,
    contact: ContactIdentity,
  ): Promise<ErasedCounts> {
    const conversations = await this.prisma.conversation.findMany({
      where: { contactId: contact.id, channelAccount: { organizationId } },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);

    const [messages, , , , sessions] = await this.prisma.$transaction([
      this.prisma.message.deleteMany({
        where: { conversationId: { in: conversationIds } },
      }),
      this.prisma.notification.deleteMany({
        where: { conversationId: { in: conversationIds } },
      }),
      this.prisma.agentState.deleteMany({
        where: { conversationId: { in: conversationIds } },
      }),
      this.prisma.conversation.deleteMany({
        where: { id: { in: conversationIds } },
      }),
      // Sesiones del asistente de ese titular (el userId del asistente es el id externo del contacto)
      this.prisma.assistantSession.deleteMany({
        where: { organizationId, externalUserId: contact.externalId },
      }),
      this.prisma.contact.delete({ where: { id: contact.id } }),
    ]);

    return {
      conversationsDeleted: conversationIds.length,
      messagesDeleted: messages.count,
      sessionsDeleted: sessions.count,
    };
  }
}
