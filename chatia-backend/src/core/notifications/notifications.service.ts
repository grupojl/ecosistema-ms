// src/core/notifications/notifications.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventsGateway } from '@/infrastructure/events/events.gateway.js';
import { NotificationType } from '@/generated/prisma/client.js';
import {
  NOTIFICATIONS_REPOSITORY,
  type INotificationsRepository,
} from '@/core/notifications/repository/notifications.repository.interface.js';

export interface CreateNotificationInput {
  organizationId: string;
  agentId: string;
  conversationId?: string;
  type: NotificationType;
  title: string;
  body: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repo: INotificationsRepository,
    private readonly events: EventsGateway,
  ) {}

  // ── Crear notificación y emitir por WebSocket ─────────────────────────────

  async create(input: CreateNotificationInput) {
    const notification = await this.repo.create({
      organizationId: input.organizationId,
      agentId: input.agentId,
      conversationId: input.conversationId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
    });

    // Emitir en tiempo real al agente específico
    this.events.emitToAgent(input.agentId, 'notification:new', notification);

    this.logger.debug(
      `Notificación ${input.type} creada para agente ${input.agentId}`,
    );

    return notification;
  }

  // ── Helpers para cada tipo de evento ─────────────────────────────────────

  async notifyNewConversation(
    organizationId: string,
    agentId: string,
    conversationId: string,
    contactName: string,
  ) {
    return this.create({
      organizationId,
      agentId,
      conversationId,
      type: NotificationType.NEW_CONVERSATION,
      title: 'Nueva conversación asignada',
      body: `${contactName ?? 'Un contacto'} inició una conversación`,
    });
  }

  async notifyNewMessage(
    organizationId: string,
    agentId: string,
    conversationId: string,
    contactName: string,
    messagePreview: string,
  ) {
    return this.create({
      organizationId,
      agentId,
      conversationId,
      type: NotificationType.NEW_MESSAGE,
      title: `Mensaje de ${contactName ?? 'contacto'}`,
      body: messagePreview.slice(0, 100),
    });
  }

  async notifyEscalation(
    organizationId: string,
    agentId: string,
    conversationId: string,
    contactName: string,
  ) {
    return this.create({
      organizationId,
      agentId,
      conversationId,
      type: NotificationType.ESCALATION,
      title: '⚠️ Escalación — se requiere atención humana',
      body: `${contactName ?? 'Un contacto'} necesita hablar con un agente`,
    });
  }

  // ── Listado ───────────────────────────────────────────────────────────────

  async list(agentId: string, onlyUnread = false, page = 1, limit = 20) {
    const { rows, total, unreadCount } = await this.repo.listForAgent(
      agentId,
      onlyUnread,
      (page - 1) * limit,
      limit,
    );

    return {
      success: true,
      data: rows,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // ── Marcar como leída ─────────────────────────────────────────────────────

  async markRead(notificationId: string, agentId: string) {
    const updated = await this.repo.markRead(notificationId, agentId);
    return { success: true, updated };
  }

  async markAllRead(agentId: string) {
    const updated = await this.repo.markAllRead(agentId);
    return { success: true, updated };
  }
}
