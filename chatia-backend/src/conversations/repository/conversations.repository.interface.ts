// chatia-backend/src/conversations/repository/conversations.repository.interface.ts
// Puerto (interface + símbolo de inyección).
// El Service inyecta esta interface via @Inject(CONVERSATIONS_REPOSITORY).
// PrismaConversationsRepository es el único adaptador.
import type { Conversation, ConversationStatus } from '../domain/conversation.entity.js';

export const CONVERSATIONS_REPOSITORY = Symbol('CONVERSATIONS_REPOSITORY');

export interface ListConversationsFilter {
  organizationId:   string;
  status?:          ConversationStatus;
  channelAccountId?: string;
  tag?:             string;
  archived?:        boolean;  // archived = deletedAt IS NOT NULL
  page?:            number;
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
}
