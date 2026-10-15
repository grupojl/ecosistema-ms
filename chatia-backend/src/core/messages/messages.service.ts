// src/core/messages/messages.service.ts
import { Logger, Injectable, NotFoundException, Inject } from '@nestjs/common';
import {
  MESSAGES_REPOSITORY,
  type IMessagesRepository,
} from '@/core/messages/repository/messages.repository.interface.js';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  constructor(
    @Inject(MESSAGES_REPOSITORY) private readonly repo: IMessagesRepository,
  ) {}

  async listByConversation(
    conversationId: string,
    organizationId: string,
    page = 1,
    limit = 50,
  ) {
    if (
      !(await this.repo.conversationBelongsTo(conversationId, organizationId))
    )
      throw new NotFoundException('Conversación no encontrada');

    const { messages, total } = await this.repo.listByConversation(
      conversationId,
      (page - 1) * limit,
      limit,
    );

    return {
      success: true,
      data: messages,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getStats(organizationId: string) {
    return {
      success: true,
      data: await this.repo.statsForOrganization(organizationId),
    };
  }
}
