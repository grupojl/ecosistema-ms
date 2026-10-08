// chatia-backend/src/core/conversations/conversations.service.ts
// Todo acceso a DB va por IConversationsRepository (ADR-002) — este service no conoce Prisma.
import {
  Injectable, NotFoundException, Logger, Optional, Inject,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue }       from 'bullmq';
import {
  CONVERSATIONS_REPOSITORY,
  type IConversationsRepository,
  type ListConversationsFilter,
} from '@/core/conversations/repository/conversations.repository.interface.js';
import type { Conversation } from '@/core/conversations/domain/conversation.entity.js';
import { addTag, removeTag } from '@/core/conversations/domain/conversation.entity.js';
import type { IncomingMessage }   from '@/channels/channel.interface.js';
import { QUEUES, JOBS }           from '@/queue/queue.constants.js';
import { AnalyticsEventsService } from '@/core/analytics-events/analytics-events.service.js';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @Inject(CONVERSATIONS_REPOSITORY) private readonly conversationsRepo: IConversationsRepository,
    @InjectQueue(QUEUES.OUTGOING_MESSAGE) private readonly outQueue: Queue,
    @Optional() private readonly analyticsEvents?: AnalyticsEventsService,
  ) {}

  // ── Mensaje entrante desde webhook ───────────────────────────────────────

  async handleIncomingMessage(
    channelAccountId: string,
    channelType: string,
    msg: IncomingMessage,
  ): Promise<void> {
    const account = await this.conversationsRepo.findChannelAccountById(channelAccountId);
    if (!account) throw new NotFoundException(`ChannelAccount ${channelAccountId} no encontrada`);

    const { organizationId, ecosystemId } = account;

    const result = await this.conversationsRepo.recordInboundMessage({
      channelAccountId,
      channelType,
      organizationId,
      contact: { externalId: msg.senderExternalId, name: msg.senderName, phone: msg.senderPhone },
      message: { content: msg.content, externalId: msg.externalId },
    });

    if (result.conversationCreated) {
      this.analyticsEvents?.trackConversationCreated({
        ecosystemId, organizationId,
        conversationId: result.conversationId,
        channel:        channelType,
        contactId:      result.contactId,
      });
    }

    this.analyticsEvents?.trackMessageSent({
      ecosystemId, organizationId,
      conversationId: result.conversationId,
      direction:      'INBOUND',
      isAiGenerated:  false,
    });
  }

  // ── Listado y detalle ─────────────────────────────────────────────────────

  list(organizationId: string, filters: Omit<ListConversationsFilter, 'organizationId'>) {
    return this.conversationsRepo.listWithRelations({ ...filters, organizationId });
  }

  async findOne(conversationId: string, organizationId: string) {
    const conv = await this.conversationsRepo.findDetailed(conversationId, organizationId);
    if (!conv) throw new NotFoundException(`Conversación ${conversationId} no encontrada`);
    return conv;
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  async sendManualMessage(conversationId: string, organizationId: string, text: string) {
    await this.verifyOwnership(conversationId, organizationId);

    const ctx = await this.conversationsRepo.getOutboundContext(conversationId, organizationId);
    if (!ctx) throw new NotFoundException(`Conversación ${conversationId} no encontrada`);

    const msg = await this.conversationsRepo.createOutboundMessage(conversationId, text);

    await this.outQueue.add(JOBS.SEND_MESSAGE, {
      messageId:           msg.id,
      conversationId,
      organizationId,
      channelType:         ctx.channelType,
      recipientExternalId: ctx.recipientExternalId,
      text,
      accessToken:         ctx.accessToken,
      extraConfig:         ctx.extraConfig,
    });
  }

  async takeover(conversationId: string, organizationId: string, agentId: string) {
    const conv    = await this.verifyOwnership(conversationId, organizationId);
    const updated = await this.conversationsRepo.takeover(conversationId, organizationId, agentId);

    const account = await this.conversationsRepo.findChannelAccountById(conv.channelAccountId);
    if (account) {
      this.analyticsEvents?.trackConversationAssigned({
        ecosystemId: account.ecosystemId, organizationId, conversationId, agentId,
      });
    }
    return updated;
  }

  async release(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    return this.conversationsRepo.release(conversationId, organizationId);
  }

  async resolve(conversationId: string, organizationId: string) {
    const conv    = await this.verifyOwnership(conversationId, organizationId);
    const updated = await this.conversationsRepo.resolve(conversationId, organizationId);

    const account = await this.conversationsRepo.findChannelAccountById(conv.channelAccountId);
    if (account) {
      this.analyticsEvents?.trackConversationResolved({
        ecosystemId: account.ecosystemId, organizationId, conversationId,
        agentId: conv.assignedAgentId ?? undefined,
      });
    }
    return updated;
  }

  async softDelete(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    return this.conversationsRepo.softDelete(conversationId, organizationId);
  }

  async restore(conversationId: string, organizationId: string) {
    await this.verifyOwnership(conversationId, organizationId);
    return this.conversationsRepo.restore(conversationId, organizationId);
  }

  async addTag(conversationId: string, organizationId: string, tag: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    return this.conversationsRepo.updateTags(conversationId, organizationId, addTag(conv, tag));
  }

  async removeTag(conversationId: string, organizationId: string, tag: string) {
    const conv = await this.verifyOwnership(conversationId, organizationId);
    return this.conversationsRepo.updateTags(conversationId, organizationId, removeTag(conv, tag));
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  private async verifyOwnership(conversationId: string, organizationId: string): Promise<Conversation> {
    const conv = await this.conversationsRepo.findOwned(conversationId, organizationId);
    if (!conv) throw new NotFoundException(`Conversación ${conversationId} no encontrada`);
    return conv;
  }
}
