// chatia-backend/src/core/conversations/repository/conversations.repository.interface.ts
// Puerto (interface + símbolo de inyección).
// El Service inyecta esta interface via @Inject(CONVERSATIONS_REPOSITORY).
// PrismaConversationsRepository es el único adaptador.
import type { Prisma } from '@prisma/client';
import type { Conversation, ConversationStatus } from '@/core/conversations/domain/conversation.entity.js';

export const CONVERSATIONS_REPOSITORY = Symbol('CONVERSATIONS_REPOSITORY');

export interface ListConversationsFilter {
  organizationId:    string;
  status?:           ConversationStatus;
  channelAccountId?: string;
  tag?:              string;
  archived?:         boolean;  // archived = deletedAt IS NOT NULL
  page?:             number;
}

// ── DT-030: ChannelAccount para handleIncomingMessage ─────────────────────────
// ConversationsService no importa PrismaService directamente.
export interface ChannelAccountRecord {
  id:             string;
  organizationId: string;
  ecosystemId:    string;
  channelType:    string;
  externalId:     string;
  accessToken:    string;
  extraConfig:    Record<string, unknown>;
}

// ── Read-models con relaciones (lo que devuelve el API HTTP) ──────────────────
export type ConversationListItem = Prisma.ConversationGetPayload<{
  include: { contact: true; assignedAgent: true; messages: true };
}>;

export type ConversationDetail = ConversationListItem;

export interface InboundMessageInput {
  channelAccountId: string;
  channelType:      string;
  organizationId:   string;
  contact: {
    externalId: string;
    name?:      string;
    phone?:     string;
  };
  message: {
    content:     string;
    externalId?: string;
  };
}

export interface InboundMessageResult {
  conversationId:      string;
  contactId:           string;
  conversationCreated: boolean;
}

/** Datos necesarios para despachar un mensaje saliente por el canal. */
export interface OutboundContext {
  channelType:         string;
  accessToken:         string;
  extraConfig:         Prisma.JsonValue;
  recipientExternalId: string;
}

export interface IConversationsRepository {
  findById(id: string, organizationId: string): Promise<Conversation | null>;

  list(filter: ListConversationsFilter): Promise<{
    data:  Conversation[];
    total: number;
    page:  number;
  }>;

  create(input: {
    channelAccountId: string;
    contactId:        string;
    organizationId:   string;
    isAiActive?:      boolean;
  }): Promise<Conversation>;

  updateStatus(
    id:             string,
    organizationId: string,
    status:         ConversationStatus,
    extra?:         Partial<Pick<Conversation, 'assignedAgentId' | 'resolvedAt'>>,
  ): Promise<Conversation>;

  updateTags(
    id:             string,
    organizationId: string,
    tags:           string[],
  ): Promise<Conversation>;

  softDelete(id: string, organizationId: string): Promise<Conversation>;

  restore(id: string, organizationId: string): Promise<Conversation>;

  updateAiActive(
    id:             string,
    organizationId: string,
    isAiActive:     boolean,
  ): Promise<Conversation>;

  findChannelAccountById(channelAccountId: string): Promise<ChannelAccountRecord | null>;

  // ── Casos de uso compuestos (multi-tabla) ───────────────────────────────────

  /** Upsert de contacto + conversación abierta + mensaje entrante, en una transacción. */
  recordInboundMessage(input: InboundMessageInput): Promise<InboundMessageResult>;

  listWithRelations(filter: ListConversationsFilter): Promise<{
    data:  ConversationListItem[];
    total: number;
    page:  number;
    pages: number;
  }>;

  findDetailed(id: string, organizationId: string): Promise<ConversationDetail | null>;

  /** Como findById pero incluye archivadas (restore / verificación de ownership). */
  findOwned(id: string, organizationId: string): Promise<Conversation | null>;

  getOutboundContext(conversationId: string, organizationId: string): Promise<OutboundContext | null>;

  /** Persiste el mensaje saliente PENDING y actualiza lastMessageAt (atómico). */
  createOutboundMessage(conversationId: string, content: string): Promise<{ id: string }>;

  /** HUMAN_TAKEOVER + agente asignado + IA desactivada. */
  takeover(id: string, organizationId: string, agentId: string): Promise<Conversation>;

  /** Vuelve a OPEN, sin agente, IA activa. */
  release(id: string, organizationId: string): Promise<Conversation>;

  /** RESOLVED + resolvedAt + IA desactivada. */
  resolve(id: string, organizationId: string): Promise<Conversation>;
}
