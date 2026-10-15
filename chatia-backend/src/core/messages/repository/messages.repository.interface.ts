// chatia-backend/src/core/messages/repository/messages.repository.interface.ts
import type { Message } from '@/generated/prisma/client.js';

export const MESSAGES_REPOSITORY = Symbol('MESSAGES_REPOSITORY');

export interface MessageStats {
  total: number;
  inbound: number;
  outbound: number;
  aiGenerated: number;
  totalTokensUsed: number;
}

export interface IMessagesRepository {
  /** ¿La conversación pertenece (vía su cuenta de canal) a la organización? */
  conversationBelongsTo(
    conversationId: string,
    organizationId: string,
  ): Promise<boolean>;
  listByConversation(
    conversationId: string,
    skip: number,
    take: number,
  ): Promise<{ messages: Message[]; total: number }>;
  /** Estadísticas de mensajes de TODAS las conversaciones de la organización. */
  statsForOrganization(organizationId: string): Promise<MessageStats>;
}
