// src/core/assistant/session/assistant-session.service.ts
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ASSISTANT_SESSION_REPOSITORY,
  type IAssistantSessionRepository,
} from '@/core/assistant/repository/assistant.repository.interface.js';

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

@Injectable()
export class AssistantSessionService {
  private readonly logger = new Logger(AssistantSessionService.name);

  constructor(
    @Inject(ASSISTANT_SESSION_REPOSITORY)
    private readonly repo: IAssistantSessionRepository,
  ) {}

  async getOrCreate(
    assistantConfigId: string,
    organizationId: string,
    externalUserId: string,
    channel: string,
  ) {
    const existing = await this.repo.findForChannel(
      assistantConfigId,
      organizationId,
      externalUserId,
      channel,
    );
    if (existing) return existing;

    const created = await this.repo.create({
      assistantConfigId,
      organizationId,
      externalUserId,
      channel,
    });
    this.logger.debug(
      `Nueva sesión: ${created.id} — usuario: ${externalUserId}`,
    );
    return created;
  }

  /**
   * Agrega un mensaje al historial de forma ATÓMICA (una sola sentencia en el repository).
   * Antes: leer el historial, agregar en memoria y reescribirlo → dos mensajes seguidos del mismo ciudadano
   * se pisaban y se perdía uno.
   */
  async appendMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ) {
    const newMsg: SessionMessage = {
      role,
      content,
      createdAt: new Date().toISOString(),
    };
    const found = await this.repo.appendMessage(sessionId, newMsg);
    if (!found) {
      throw new NotFoundException(`Sesión ${sessionId} no encontrada`);
    }
    return newMsg;
  }

  async getHistory(sessionId: string, limit = 10): Promise<SessionMessage[]> {
    const session = await this.repo.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Sesión ${sessionId} no encontrada`);
    }
    const history = Array.isArray(session.history)
      ? (session.history as unknown as SessionMessage[])
      : [];
    return history.slice(-limit);
  }

  async resetSession(sessionId: string) {
    await this.repo.reset(sessionId);
    this.logger.log(`Sesión reseteada: ${sessionId}`);
  }

  async findByUser(
    assistantConfigId: string,
    organizationId: string,
    externalUserId: string,
  ) {
    return this.repo.findLatestByUser(
      assistantConfigId,
      organizationId,
      externalUserId,
    );
  }

  async deleteByUser(
    assistantConfigId: string,
    organizationId: string,
    externalUserId: string,
  ) {
    const session = await this.findByUser(
      assistantConfigId,
      organizationId,
      externalUserId,
    );
    if (!session) return null;
    await this.repo.delete(session.id);
    return session;
  }
}
