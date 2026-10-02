// chatia-backend/src/conversations/domain/conversation.errors.ts
// Errores de dominio tipados — sin imports de NestJS.
// El Service los captura y los convierte a NotFoundException, BadRequestException, etc.

export class ConversationNotFoundError extends Error {
  constructor(conversationId: string) {
    super(`Conversation not found: ${conversationId}`);
    this.name = 'ConversationNotFoundError';
  }
}

export class ConversationAccessDeniedError extends Error {
  constructor(conversationId: string, organizationId: string) {
    super(`Conversation ${conversationId} does not belong to org ${organizationId}`);
    this.name = 'ConversationAccessDeniedError';
  }
}

export class ConversationTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid conversation transition: ${from} → ${to}`);
    this.name = 'ConversationTransitionError';
  }
}

export class ConversationDeletedError extends Error {
  constructor(conversationId: string) {
    super(`Conversation is deleted: ${conversationId}`);
    this.name = 'ConversationDeletedError';
  }
}
