// chatia-backend/src/conversations/conversations.service.ts
// Versión limpia — usa solo métodos y campos que existen en el schema real.
// Ver: chatia-backend/prisma/schema.prisma para la definición de Message, Conversation, etc.
import {
  Injectable, NotFoundException, Logger, Optional,
} from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bullmq';
import { Queue }              from 'bullmq';
import { Inject } from '@nestjs/common';
import { CONVERSATIONS_REPOSITORY, IConversationsRepository } from './repository/conversations.repository.interface';
import {
  ConversationStatus, ChannelType,
  MessageDirection, MessageType, MessageStatus,
} from '@prisma/client';
import type { IncomingMessage }       from '../channels/channel.interface';
import { QUEUES, JOBS }               from '../queue/queue.constants';
import { AnalyticsEventsService }     from '../analytics-events/analytics-events.service';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @Inject(CONVERSATIONS_REPOSITORY) private readonly conversationsRepo: IConversationsRepository,
    @InjectQueue(QUEUES.OUTGOING_MESSAGE ?? 'outgoing-message') private readonly outQueue: Queue,
    @Optional() private readonly analyticsEvents?: AnalyticsEventsService,
  ) {}

  // ── Mensaje entrante desde webhook ───────────────────────────────────────

  async handleIncomingMessage(
    channelAccountId: string,
    channelType: ChannelType,
    msg: IncomingMessage,
  ): Promise<void> {
    const account = await this.prisma.channelAccount.findUnique({
      where:   { id: channelAccountId },
      include: { organization: true },
    });
    if (!account) throw new NotFoundException(`ChannelAccount ${channelAccountId} no encontrada`);

    const organizationId = account.organizationId;
    const ecosystemId    = account.organization.ecosystemId;

    // Upsert contacto
    const contact = await this.prisma.contact.upsert({
      where: {
        organizationId_channelType_externalId: {
          organizationId, channelType, externalId: msg.senderExternalId,
        },
      },
      update: { lastSeenAt: new Date() },
      create: {
        organizationId, channelType,
        externalId: msg.senderExternalId,
        name:       msg.senderName,
        phone:      msg.senderPhone,
      },
    });

    // Buscar o crear conversación
    let conv = await this.prisma.conversation.findFirst({
      where: {
        channelAccountId, contactId: contact.id,
        status:    { in: [ConversationStatus.OPEN, ConversationStatus.HUMAN_TAKEOVER] },
        deletedAt: null,
      },
    });

    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: { channelAccountId, contactId: contact.id, lastMessageAt: new Date() },
      });
      this.analyticsEvents?.trackConversationCreated({
        ecosystemId, organizationId,
        conversationId: conv.id,
        channel: channelType,
        contactId: contact.id,
      });
    }

    // Persistir mensaje — Message solo tiene createdAt, NO sentAt
    await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        direction:  MessageDirection.INBOUND,
        type:       MessageType.TEXT,
        status:     MessageStatus.DELIVERED,
        content:    msg.content,
        externalId: msg.externalId,
      },
    });

    this.analyticsEvents?.trackMessageSent({
      ecosystemId, organizationId,
      conversationId: conv.id,
      direction:      'INBOUND',
      isAiGenerated:  false,
    });
  }

  // ── Listado y detalle ─────────────────────────────────────────────────────

  async list(organizationId: string, filters: {
    status?:           ConversationStatus;
    channelAccountId?: string;
    tag?:              string;
    archived?:         boolean;
    page?:             number;
  }) {
    const page = filters.page ?? 1;
    const take = 20;
    const skip = (page - 1) * take;

    const where: Record<string, unknown> = {
      channelAccount: { organizationId },
      deletedAt: filters.archived ? { not: null } : null,
    };
    if (filters.status)           where['status']           = filters.status;
    if (filters.channelAccountId) where['channelAccountId'] = filters.channelAccountId;
    if (filters.tag)              where['tags']              = { has: filters.tag };

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          contact:       true,
          assignedAgent: true,
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { lastMessageAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { data, total, page, pages: Math.ceil(total / take) };
  }

  async findOne(conversationId: string, organizationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where:   { id: conversationId, channelAccount: { organizationId } },
      include: { contact: true, assignedAgent: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException(`Conversación ${conversationId} no encontrada`);
    return conv;
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  async sendManualMessage(conversationId: string, organizationId: string, text: string) {
    const conv    = await this.verifyOwnership(conversationId, organizationId);
    const acct    = await this.prisma.channelAccount.findUniqueOrThrow({ where: { id: conv.channelAccountId } });
    const contact = await this.prisma.contact.findUniqueOrThrow({ where: { id: conv.contactId } });

    // Message NO tiene sentAt — solo createdAt (automático)
    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        direction:     MessageDirection.OUTBOUND,
        type:          MessageType.TEXT,
        status:        MessageStatus.PENDING,
        content:       text,
        isAiGenerated: false,
      },
    });

    // JOBS.SEND_MESSAGE existe en queue.constants, no SEND_OUTGOING_MESSAGE
    await this.outQueue.add(JOBS.SEND_MESSAGE, {
      messageId:           msg.id,
      conversationId,
      organizationId,
      channelType:         acct.channelType,
      recipientExternalId: contact.externalId,
      text,
      accessToken:         acct.accessToken,
      extraConfig:         acct.extraConfig,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { lastMessageAt: new Date() },
    });
  }

  async takeover(conversationId: string, organizationId: string, agentId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { status: ConversationStatus.HUMAN_TAKEOVER, assignedAgentId: agentId, isAiActive: false },
    });
    const acct = await this.prisma.channelAccount.findUnique({
      where: { id: updated.channelAccountId }, include: { organization: true },
    });
    if (acct) {
      this.analyticsEvents?.trackConversationAssigned({
        ecosystemId: acct.organization.ecosystemId, organizationId, conversationId, agentId,
      });
    }
    return updated;
  }

  async release(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { status: ConversationStatus.OPEN, assignedAgentId: null, isAiActive: true },
    });
  }

  async resolve(conversationId: string, organizationId: string) {
    const conv    = await this.verifyOwnership(conversationId, organizationId);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { status: ConversationStatus.RESOLVED, resolvedAt: new Date(), isAiActive: false },
    });
    const acct = await this.prisma.channelAccount.findUnique({
      where: { id: conv.channelAccountId }, include: { organization: true },
    });
    if (acct) {
      this.analyticsEvents?.trackConversationResolved({
        ecosystemId: acct.organization.ecosystemId, organizationId, conversationId,
        agentId: conv.assignedAgentId ?? undefined,
      });
    }
    return updated;
  }

  async softDelete(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    return this.prisma.conversation.update({
      where: { id: conversationId }, data: { deletedAt: new Date() },
    });
  }

  async restore(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    return this.prisma.conversation.update({
      where: { id: conversationId }, data: { deletedAt: null },
    });
  }

  async addTag(conversationId: string, organizationId: string, tag: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    const tags = [...new Set([...conv.tags, tag])];
    return this.prisma.conversation.update({ where: { id: conversationId }, data: { tags } });
  }

  async removeTag(conversationId: string, organizationId: string, tag: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    const tags = conv.tags.filter((t: string) => t !== tag);
    return this.prisma.conversation.update({ where: { id: conversationId }, data: { tags } });
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  private async verifyOwnership(conversationId: string, organizationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, channelAccount: { organizationId } },
    });
    if (!conv) throw new NotFoundException(`Conversación ${conversationId} no encontrada`);
    return conv;
  }
}
