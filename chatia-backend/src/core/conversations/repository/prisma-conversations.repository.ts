import { z } from 'zod';
// chatia-backend/src/conversations/repository/prisma-conversations.repository.ts
//
// Adaptador Prisma → entidad de dominio.
// Es el ÚNICO lugar del módulo conversations que importa PrismaService.
// toEntity() es el mapper explícito — TypeScript falla aquí si Prisma cambia el schema.
//
// MOLDE VIVO — todos los repositorios del ecosistema-ms siguen este patrón.

import { Injectable }  from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type {
  IConversationsRepository,
  ListConversationsFilter,
  ChannelAccountRecord,
  ConversationDetail,
  ConversationListItem,
  InboundMessageInput,
  InboundMessageResult,
  OutboundContext,
} from '@/core/conversations/repository/conversations.repository.interface.js';
import type {
  Conversation,
  ConversationStatus,
  ConversationStage,
} from '@/core/conversations/domain/conversation.entity.js';
import {
  ChannelType,
  ConversationStatus as PrismaConversationStatus,
  MessageDirection,
  MessageStatus,
  MessageType,
  type Conversation as PrismaConversation,
} from '@prisma/client';

@Injectable()
export class PrismaConversationsRepository implements IConversationsRepository {

  constructor(private readonly prisma: PrismaService) {}

  // ── Mapper privado — el único lugar que conoce ambos tipos ─────────────────

  private toEntity(row: PrismaConversation & { organizationId?: string }): Conversation {
    return {
      id:               row.id,
      channelAccountId: row.channelAccountId,
      contactId:        row.contactId,
      // organizationId viene del join con Contact o ChannelAccount según la query
      // Nota de arquitectura: organizationId viene del join con Contact, no del modelo Conversation (ver schema.prisma)
      organizationId:   (row as { organizationId?: string }).organizationId ?? '',
      status:           row.status          as ConversationStatus,
      stage:            row.stage           as ConversationStage,
      isAiActive:       row.isAiActive,
      assignedAgentId:  row.assignedAgentId,
      detectedIntent:   row.detectedIntent,
      // Zod parse: campo Json de Prisma — validar shape en el boundary del repository
      extractedEntities: z.record(z.string(), z.string()).catch({}).parse(row.extractedEntities ?? {}),
      summary:          row.summary,
      tags:             row.tags,
      lastMessageAt:    row.lastMessageAt,
      resolvedAt:       row.resolvedAt,
      deletedAt:        row.deletedAt,
      createdAt:        row.createdAt,
      updatedAt:        row.updatedAt,
    };
  }

  // ── Métodos de la interface ─────────────────────────────────────────────────

  async findById(id: string, organizationId: string): Promise<Conversation | null> {
    const row = await this.prisma.conversation.findFirst({
      where: {
        id,
        contact: { organizationId },
        deletedAt: null,
      },
      include: { contact: { select: { organizationId: true } } },
    });
    if (!row) return null;
    return this.toEntity({ ...row, organizationId: row.contact.organizationId });
  }

  async list(filter: ListConversationsFilter): Promise<{
    data: Conversation[]; total: number; page: number;
  }> {
    const { organizationId, status, channelAccountId, tag, archived, page = 1 } = filter;
    const take = 20;
    const skip = (page - 1) * take;

    const where = {
      contact:         { organizationId },
      ...(status          ? { status }          : {}),
      ...(channelAccountId ? { channelAccountId } : {}),
      ...(tag             ? { tags: { has: tag } } : {}),
      deletedAt:       archived ? { not: null } : null,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        include: { contact: { select: { organizationId: true } } },
        orderBy: { lastMessageAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data:  rows.map((r) => this.toEntity({ ...r, organizationId: r.contact.organizationId })),
      total,
      page,
    };
  }

  async create(input: {
    channelAccountId: string;
    contactId:        string;
    organizationId:   string;
    isAiActive?:      boolean;
  }): Promise<Conversation> {
    const row = await this.prisma.conversation.create({
      data: {
        channelAccountId: input.channelAccountId,
        contactId:        input.contactId,
        isAiActive:       input.isAiActive ?? true,
      },
      include: { contact: { select: { organizationId: true } } },
    });
    return this.toEntity({ ...row, organizationId: input.organizationId });
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: ConversationStatus,
    extra?: Partial<Pick<Conversation, 'assignedAgentId' | 'resolvedAt'>>,
  ): Promise<Conversation> {
    const row = await this.prisma.conversation.update({
      where: { id },
      data:  { status, ...extra },
      include: { contact: { select: { organizationId: true } } },
    });
    return this.toEntity({ ...row, organizationId });
  }

  async updateTags(id: string, organizationId: string, tags: string[]): Promise<Conversation> {
    const row = await this.prisma.conversation.update({
      where: { id },
      data:  { tags },
      include: { contact: { select: { organizationId: true } } },
    });
    return this.toEntity({ ...row, organizationId });
  }

  async softDelete(id: string, organizationId: string): Promise<Conversation> {
    const row = await this.prisma.conversation.update({
      where: { id },
      data:  { deletedAt: new Date() },
      include: { contact: { select: { organizationId: true } } },
    });
    return this.toEntity({ ...row, organizationId });
  }

  async restore(id: string, organizationId: string): Promise<Conversation> {
    const row = await this.prisma.conversation.update({
      where: { id },
      data:  { deletedAt: null },
      include: { contact: { select: { organizationId: true } } },
    });
    return this.toEntity({ ...row, organizationId });
  }

  async updateAiActive(id: string, organizationId: string, isAiActive: boolean): Promise<Conversation> {
      const row = await this.prisma.conversation.update({
        where: { id },
        data:  { isAiActive },
        include: { contact: { select: { organizationId: true } } },
      });
      return this.toEntity({ ...row, organizationId });
  }

  // ── DT-030: elimina this.prisma.channelAccount en ConversationsService ──
  async findChannelAccountById(
    channelAccountId: string,
  ): Promise<ChannelAccountRecord | null> {
    const account = await this.prisma.channelAccount.findUnique({
      where:   { id: channelAccountId },
      include: { organization: { select: { ecosystemId: true } } },
    });
    if (!account) return null;
    return {
      id:             account.id,
      organizationId: account.organizationId,
      ecosystemId:    (account.organization as { ecosystemId: string } | null)?.ecosystemId ?? '',
      channelType:    account.channelType as string,
      externalId:     account.externalId,
      accessToken:    account.accessToken,
      extraConfig:    (account.extraConfig ?? {}) as Record<string, unknown>,
    };
  }

  // ── Casos de uso compuestos ────────────────────────────────────────────────

  async recordInboundMessage(input: InboundMessageInput): Promise<InboundMessageResult> {
    const { channelAccountId, organizationId, contact: c, message: m } = input;
    const channelType = input.channelType as ChannelType;

    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.upsert({
        where: {
          organizationId_channelType_externalId: {
            organizationId, channelType, externalId: c.externalId,
          },
        },
        update: { lastSeenAt: new Date() },
        create: { organizationId, channelType, externalId: c.externalId, name: c.name, phone: c.phone },
      });

      let conv = await tx.conversation.findFirst({
        where: {
          channelAccountId,
          contactId: contact.id,
          status:    { in: [PrismaConversationStatus.OPEN, PrismaConversationStatus.HUMAN_TAKEOVER] },
          deletedAt: null,
        },
      });
      const conversationCreated = !conv;
      if (!conv) {
        conv = await tx.conversation.create({
          data: { channelAccountId, contactId: contact.id, lastMessageAt: new Date() },
        });
      }

      // Message solo tiene createdAt (no sentAt)
      await tx.message.create({
        data: {
          conversationId: conv.id,
          direction:  MessageDirection.INBOUND,
          type:       MessageType.TEXT,
          status:     MessageStatus.DELIVERED,
          content:    m.content,
          externalId: m.externalId,
        },
      });

      return { conversationId: conv.id, contactId: contact.id, conversationCreated };
    });
  }

  async listWithRelations(filter: ListConversationsFilter): Promise<{
    data: ConversationListItem[]; total: number; page: number; pages: number;
  }> {
    const { organizationId, status, channelAccountId, tag, archived, page = 1 } = filter;
    const take = 20;
    const skip = (page - 1) * take;

    const where = {
      channelAccount: { organizationId },
      deletedAt:      archived ? { not: null } : null,
      ...(status           ? { status }           : {}),
      ...(channelAccountId ? { channelAccountId } : {}),
      ...(tag              ? { tags: { has: tag } } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
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

  async findDetailed(id: string, organizationId: string): Promise<ConversationDetail | null> {
    return this.prisma.conversation.findFirst({
      where:   { id, channelAccount: { organizationId } },
      include: { contact: true, assignedAgent: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async findOwned(id: string, organizationId: string): Promise<Conversation | null> {
    const row = await this.prisma.conversation.findFirst({
      where:   { id, channelAccount: { organizationId } },
    });
    return row ? this.toEntity({ ...row, organizationId }) : null;
  }

  async getOutboundContext(conversationId: string, organizationId: string): Promise<OutboundContext | null> {
    const conv = await this.prisma.conversation.findFirst({
      where:   { id: conversationId, channelAccount: { organizationId } },
      include: { channelAccount: true, contact: true },
    });
    if (!conv) return null;
    return {
      channelType:         conv.channelAccount.channelType,
      accessToken:         conv.channelAccount.accessToken,
      extraConfig:         conv.channelAccount.extraConfig,
      recipientExternalId: conv.contact.externalId,
    };
  }

  async createOutboundMessage(conversationId: string, content: string): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          direction:     MessageDirection.OUTBOUND,
          type:          MessageType.TEXT,
          status:        MessageStatus.PENDING,
          content,
          isAiGenerated: false,
        },
        select: { id: true },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });
      return msg;
    });
  }

  async takeover(id: string, organizationId: string, agentId: string): Promise<Conversation> {
    const row = await this.prisma.conversation.update({
      where: { id },
      data:  { status: PrismaConversationStatus.HUMAN_TAKEOVER, assignedAgentId: agentId, isAiActive: false },
    });
    return this.toEntity({ ...row, organizationId });
  }

  async release(id: string, organizationId: string): Promise<Conversation> {
    const row = await this.prisma.conversation.update({
      where: { id },
      data:  { status: PrismaConversationStatus.OPEN, assignedAgentId: null, isAiActive: true },
    });
    return this.toEntity({ ...row, organizationId });
  }

  async resolve(id: string, organizationId: string): Promise<Conversation> {
    const row = await this.prisma.conversation.update({
      where: { id },
      data:  { status: PrismaConversationStatus.RESOLVED, resolvedAt: new Date(), isAiActive: false },
    });
    return this.toEntity({ ...row, organizationId });
  }
}
