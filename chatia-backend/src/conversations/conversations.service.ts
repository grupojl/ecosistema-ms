// chatia-backend/src/conversations/conversations.service.ts
//
// ADR-003 A-1.4 semana 7 — AnalyticsEventsService inyectado.
// Los track*() son fire-and-forget: NUNCA rompen el flujo de chat.

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectQueue }      from '@nestjs/bullmq';
import { Queue }            from 'bullmq';
import { PrismaService }    from '../prisma/prisma.service';
import { LangGraphEngine }  from '../langgraph/langgraph.engine';
import { ChannelRegistry }  from '../channels/channel.registry';
import { IncomingMessage }  from '../channels/channel.interface';
import {
  ChannelType,
  ConversationStatus,
  MessageDirection,
  MessageType,
  MessageStatus,
} from '@prisma/client';
import { AssistantChatService }    from '../assistant/chat/assistant-chat.service';
import { EventsGateway }           from '../events/events.gateway';
import { AssignmentService }       from '../assignment/assignment.service';
import { NotificationsService }    from '../notifications/notifications.service';
import { QUEUES, JOBS }            from '../queue/queue.constants';
import type { OutgoingMessageJobData } from '../queue/processors/outgoing-message.processor';

// ADR-003 A-1.4 — producer de eventos analytics (Optional para no romper tests)
import { AnalyticsEventsService } from '../analytics-events/analytics-events.service';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma:       PrismaService,
    private readonly channelReg:   ChannelRegistry,
    private readonly events:       EventsGateway,
    private readonly assignment:   AssignmentService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.OUTGOING_MESSAGE) private readonly outQueue: Queue<OutgoingMessageJobData>,
    @Optional() private readonly langGraph?: LangGraphEngine,
    @Optional() private readonly assistant?: AssistantChatService,
    // Optional para que los tests existentes no rompan mientras no mockeen este dep
    @Optional() private readonly analyticsEvents?: AnalyticsEventsService,
  ) {}

  // ── Procesamiento de mensaje entrante ────────────────────────────────────

  async handleIncomingMessage(
    channelAccountId: string,
    channelType:      ChannelType,
    msg:              IncomingMessage,
  ): Promise<void> {
    const account = await this.prisma.channelAccount.findUnique({
      where:   { id: channelAccountId },
      include: { organization: true },
    });
    if (!account) throw new NotFoundException(`ChannelAccount ${channelAccountId} no encontrada`);

    const organizationId = account.organizationId;
    const ecosystemId    = account.organization.ecosystemId;

    const contact      = await this.upsertContact(organizationId, channelType, msg);
    const { conv, isNew } = await this.getOrCreateConversation(
      channelAccountId, contact.id, organizationId, contact.name ?? msg.senderName ?? 'Sin nombre',
    );

    // ADR-003: emitir evento si es conversación nueva
    if (isNew) {
      this.analyticsEvents?.trackConversationCreated({
        ecosystemId,
        organizationId,
        conversationId: conv.id,
        channel:        channelType,
        contactId:      contact.id,
      });
    }

    // Persistir mensaje entrante
    await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        direction:      MessageDirection.INBOUND,
        type:           MessageType.TEXT,
        status:         MessageStatus.DELIVERED,
        content:        msg.content,
        externalId:     msg.externalId,
        sentAt:         msg.timestamp,
      },
    });

    // ADR-003: emitir mensaje.sent (INBOUND)
    this.analyticsEvents?.trackMessageSent({
      ecosystemId,
      organizationId,
      conversationId: conv.id,
      direction:      'INBOUND',
      isAiGenerated:  false,
    });

    // Emitir por WebSocket al dashboard
    this.events.emitToOrg(organizationId, 'message:new', {
      conversationId: conv.id,
      message:        msg.content,
    });

    if (!conv.isAiActive) return;

    // Procesamiento IA
    try {
      let aiResponse: string | null = null;

      if (this.langGraph) {
        aiResponse = await this.langGraph.process(conv.id, msg.content, organizationId);
      } else if (this.assistant && account.projectId) {
        const result = await this.assistant.chat({
          projectSlug:    account.projectId,
          organizationId,
          userId:         contact.id,
          message:        msg.content,
          channel:        channelType,
        });
        aiResponse = result.response;
      }

      if (aiResponse) {
        await this.sendAndSave(
          conv.id, channelAccountId, channelType,
          msg.senderExternalId, aiResponse,
          account.accessToken,
          account.extraConfig as Record<string, unknown>,
          account.webhookVerifyToken,
          organizationId,
          true, // isAiGenerated
        );

        this.analyticsEvents?.trackMessageSent({
          ecosystemId,
          organizationId,
          conversationId: conv.id,
          direction:      'OUTBOUND',
          isAiGenerated:  true,
        });
      }
    } catch (e: unknown) {
      this.logger.error(`Error en procesamiento IA para ${conv.id}: ${String(e)}`);
    }
  }

  // ── Listado y detalle ─────────────────────────────────────────────────────

  async list(
    organizationId: string,
    filters: {
      status?:           ConversationStatus;
      channelAccountId?: string;
      tag?:              string;
      archived?:         boolean;
      page?:             number;
    },
  ) {
    const page  = filters.page ?? 1;
    const take  = 20;
    const skip  = (page - 1) * take;

    const where: Record<string, unknown> = {
      channelAccount: { organizationId },
      deletedAt:      filters.archived ? { not: null } : null,
    };
    if (filters.status)           where['status']           = filters.status;
    if (filters.channelAccountId) where['channelAccountId'] = filters.channelAccountId;
    if (filters.tag)              where['tags']              = { has: filters.tag };

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: { contact: true, assignedAgent: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
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

  async sendManualMessage(conversationId: string, organizationId: string, text: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    const acct = await this.prisma.channelAccount.findUnique({ where: { id: conv.channelAccountId } });
    if (!acct) throw new NotFoundException('ChannelAccount no encontrada');
    const contact = await this.prisma.contact.findUnique({ where: { id: conv.contactId } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');

    await this.sendAndSave(
      conversationId, conv.channelAccountId, acct.channelType,
      contact.externalId, text,
      acct.accessToken,
      acct.extraConfig as Record<string, unknown>,
      acct.webhookVerifyToken,
      organizationId,
      false,
    );
  }

  async takeover(conversationId: string, organizationId: string, agentId: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    const acct = await this.prisma.channelAccount.findUnique({
      where:   { id: conv.channelAccountId },
      include: { organization: true },
    });

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  {
        status:          ConversationStatus.HUMAN_TAKEOVER,
        assignedAgentId: agentId,
        isAiActive:      false,
      },
    });

    // ADR-003: emitir evento de asignación
    if (acct) {
      this.analyticsEvents?.trackConversationAssigned({
        ecosystemId:    acct.organization.ecosystemId,
        organizationId,
        conversationId,
        agentId,
      });
    }

    this.events.emitToOrg(organizationId, 'conversation:takeover', { conversationId, agentId });
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
    const conv = await this.verifyOwnership(conversationId, organizationId);
    const acct = await this.prisma.channelAccount.findUnique({
      where:   { id: conv.channelAccountId },
      include: { organization: true },
    });

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  {
        status:     ConversationStatus.RESOLVED,
        resolvedAt: new Date(),
        isAiActive: false,
      },
    });

    // ADR-003: emitir evento de resolución
    if (acct) {
      const durationMin = conv.createdAt
        ? Math.round((Date.now() - conv.createdAt.getTime()) / 60_000)
        : undefined;

      this.analyticsEvents?.trackConversationResolved({
        ecosystemId:    acct.organization.ecosystemId,
        organizationId,
        conversationId,
        agentId:        conv.assignedAgentId ?? undefined,
        durationMin,
      });
    }

    this.events.emitToOrg(organizationId, 'conversation:resolved', { conversationId });
    return updated;
  }

  async softDelete(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { deletedAt: new Date() },
    });
  }

  async restore(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { deletedAt: null },
    });
  }

  async addTag(conversationId: string, organizationId: string, tag: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    const tags = [...new Set([...conv.tags, tag])];
    return this.prisma.conversation.update({ where: { id: conversationId }, data: { tags } });
  }

  async removeTag(conversationId: string, organizationId: string, tag: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    const tags = conv.tags.filter(t => t !== tag);
    return this.prisma.conversation.update({ where: { id: conversationId }, data: { tags } });
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async upsertContact(
    organizationId: string,
    channelType:    ChannelType,
    msg:            IncomingMessage,
  ) {
    return this.prisma.contact.upsert({
      where:  { organizationId_channelType_externalId: { organizationId, channelType, externalId: msg.senderExternalId } },
      update: {
        name:       msg.senderName ?? undefined,
        avatarUrl:  msg.senderAvatarUrl ?? undefined,
        username:   msg.senderUsername ?? undefined,
        phone:      msg.senderPhone ?? undefined,
        lastSeenAt: new Date(),
      },
      create: {
        organizationId,
        channelType,
        externalId: msg.senderExternalId,
        name:       msg.senderName,
        avatarUrl:  msg.senderAvatarUrl,
        username:   msg.senderUsername,
        phone:      msg.senderPhone,
      },
    });
  }

  private async getOrCreateConversation(
    channelAccountId: string,
    contactId:        string,
    organizationId:   string,
    _contactName:     string,
  ): Promise<{ conv: Awaited<ReturnType<typeof this.prisma.conversation.findFirst>> & object; isNew: boolean }> {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        channelAccountId,
        contactId,
        status: { in: [ConversationStatus.OPEN, ConversationStatus.HUMAN_TAKEOVER] },
        deletedAt: null,
      },
    });

    if (existing) return { conv: existing, isNew: false };

    const agentId = await this.assignment.assignAgent(organizationId);
    const created  = await this.prisma.conversation.create({
      data: {
        channelAccountId,
        contactId,
        assignedAgentId: agentId,
        status:          ConversationStatus.OPEN,
        lastMessageAt:   new Date(),
      },
    });

    // Notificación in-app al agente asignado
    if (agentId) {
      await this.notifications.createForAgent(agentId, {
        conversationId: created.id,
        type:           'NEW_CONVERSATION',
      }).catch(() => {/* non-critical */});
    }

    return { conv: created, isNew: true };
  }

  private async sendAndSave(
    conversationId:      string,
    channelAccountId:    string,
    channelType:         ChannelType,
    recipientExternalId: string,
    text:                string,
    accessToken:         string,
    extraConfig:         Record<string, unknown>,
    webhookVerifyToken:  string,
    organizationId:      string,
    isAiGenerated = false,
    tokensUsed?: number,
    modelUsed?:  string,
  ) {
    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        direction:    MessageDirection.OUTBOUND,
        type:         MessageType.TEXT,
        status:       MessageStatus.PENDING,
        content:      text,
        isAiGenerated,
        tokensUsed:   tokensUsed ?? null,
        modelUsed:    modelUsed  ?? null,
        sentAt:       new Date(),
      },
    });

    await this.outQueue.add(JOBS.SEND_OUTGOING_MESSAGE, {
      messageId:           msg.id,
      conversationId,
      organizationId,
      channelType,
      recipientExternalId,
      text,
      accessToken,
      externalId:          extraConfig['externalId'] as string ?? '',
      extraConfig,
      webhookVerifyToken,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data:  { lastMessageAt: new Date() },
    });
  }

  private async getAccountIds(organizationId: string, specificId?: string): Promise<string[]> {
    if (specificId) return [specificId];
    const accounts = await this.prisma.channelAccount.findMany({
      where:  { organizationId, isActive: true },
      select: { id: true },
    });
    return accounts.map(a => a.id);
  }

  private async verifyOwnership(conversationId: string, organizationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, channelAccount: { organizationId } },
    });
    if (!conv) throw new NotFoundException(`Conversación ${conversationId} no encontrada`);
    return conv;
  }
}
