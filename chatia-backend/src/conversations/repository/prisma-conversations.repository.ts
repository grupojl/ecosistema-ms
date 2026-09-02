// chatia-backend/src/conversations/repository/prisma-conversations.repository.ts
//
// Adaptador Prisma → entidad de dominio.
// Es el ÚNICO lugar del módulo conversations que importa PrismaService.
// toEntity() es el mapper explícito — TypeScript falla aquí si Prisma cambia el schema.
//
// MOLDE VIVO — todos los repositorios del ecosistema-ms siguen este patrón.

import { Injectable }  from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  IConversationsRepository,
  ListConversationsFilter,
} from './conversations.repository.interface.js';
import type {
  Conversation,
  ConversationStatus,
  ConversationStage,
} from '../domain/conversation.entity.js';
import type { Conversation as PrismaConversation } from '@prisma/client';

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
      // @ecosistema-ms/jsonb-cast — Prisma no tiene organizationId directo en Conversation
      organizationId:   (row as { organizationId?: string }).organizationId ?? '',
      status:           row.status          as ConversationStatus,
      stage:            row.stage           as ConversationStage,
      isAiActive:       row.isAiActive,
      assignedAgentId:  row.assignedAgentId,
      detectedIntent:   row.detectedIntent,
      // @ecosistema-ms/jsonb-cast — Prisma retorna Json
      extractedEntities: (row.extractedEntities as Record<string, string>) ?? {},
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
}
