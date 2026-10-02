// chatia-backend/src/analytics-events/analytics-events.service.ts
//
// ADR-003 A-1.4 — Producer de eventos hacia analytics-backend.
// BEST-EFFORT: nunca lanza error al caller — si falla el enqueue, se loguea y se sigue.
// El tráfico operacional de chat nunca se degrada por un fallo de analytics.

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bullmq';
import { Queue }              from 'bullmq';

export const ANALYTICS_QUEUE = 'analytics.events';

export type AnalyticsEventType =
  | 'conversation.created'
  | 'conversation.resolved'
  | 'conversation.escalated'
  | 'conversation.assigned'
  | 'conversation.resolved_by_agent'
  | 'message.sent'
  | 'message.response_time'
  | 'agent.response_time';

export interface AnalyticsEventJob {
  ecosystemId:    string;
  organizationId: string;
  eventType:      AnalyticsEventType;
  payload:        Record<string, unknown>;
  occurredAtUnix: number;
}

@Injectable()
export class AnalyticsEventsService {
  private readonly logger = new Logger(AnalyticsEventsService.name);

  constructor(
    @InjectQueue(ANALYTICS_QUEUE) private readonly queue: Queue<AnalyticsEventJob>,
  ) {}

  /** Encola un evento. Fire-and-forget — nunca await esto en path crítico. */
  async track(event: AnalyticsEventJob): Promise<void> {
    try {
      await this.queue.add(event.eventType, event, {
        removeOnComplete: 100,
        removeOnFail:     50,
        attempts:         1, // best-effort, sin retry
      });
    } catch (e: unknown) {
      this.logger.warn(`Analytics enqueue falló (ignorado): ${String(e)}`);
    }
  }

  // ── Helpers tipados por evento ────────────────────────────────────────────

  trackConversationCreated(p: {
    ecosystemId: string; organizationId: string;
    conversationId: string; channel: string; contactId: string;
  }): void {
    void this.track({
      ecosystemId:    p.ecosystemId,
      organizationId: p.organizationId,
      eventType:      'conversation.created',
      payload:        { conversationId: p.conversationId, channel: p.channel, contactId: p.contactId },
      occurredAtUnix: Math.floor(Date.now() / 1_000),
    });
  }

  trackConversationResolved(p: {
    ecosystemId: string; organizationId: string;
    conversationId: string; agentId?: string; durationMin?: number;
  }): void {
    void this.track({
      ecosystemId:    p.ecosystemId,
      organizationId: p.organizationId,
      eventType:      'conversation.resolved',
      payload:        { conversationId: p.conversationId, agentId: p.agentId, durationMin: p.durationMin },
      occurredAtUnix: Math.floor(Date.now() / 1_000),
    });
    if (p.agentId) {
      void this.track({
        ecosystemId:    p.ecosystemId,
        organizationId: p.organizationId,
        eventType:      'conversation.resolved_by_agent',
        payload:        { conversationId: p.conversationId, agentId: p.agentId },
        occurredAtUnix: Math.floor(Date.now() / 1_000),
      });
    }
  }

  trackConversationAssigned(p: {
    ecosystemId: string; organizationId: string;
    conversationId: string; agentId: string;
  }): void {
    void this.track({
      ecosystemId:    p.ecosystemId,
      organizationId: p.organizationId,
      eventType:      'conversation.assigned',
      payload:        { conversationId: p.conversationId, agentId: p.agentId },
      occurredAtUnix: Math.floor(Date.now() / 1_000),
    });
  }

  trackMessageSent(p: {
    ecosystemId: string; organizationId: string;
    conversationId: string; direction: 'INBOUND' | 'OUTBOUND'; isAiGenerated: boolean;
  }): void {
    void this.track({
      ecosystemId:    p.ecosystemId,
      organizationId: p.organizationId,
      eventType:      'message.sent',
      payload:        { conversationId: p.conversationId, direction: p.direction, isAiGenerated: p.isAiGenerated },
      occurredAtUnix: Math.floor(Date.now() / 1_000),
    });
  }
}
