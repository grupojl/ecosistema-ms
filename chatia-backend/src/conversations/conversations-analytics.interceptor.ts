// chatia-backend/src/conversations/conversations-analytics.interceptor.ts
//
// ADR-003 A-1.4 — Interceptor que emite eventos analytics en operaciones de conversación.
// Patrón: NestJS CallHandler interceptor — no modifica conversations.service.ts.
//
// Cuándo usar vs inyectar directo:
//   - Este archivo es el punto de integración para semana 6.
//   - En semana 7 (refactor): mover las llamadas directamente a ConversationsService.
//
// Eventos emitidos:
//   - conversation.created   → en handleIncomingMessage / create
//   - conversation.resolved  → en resolve / close
//   - conversation.assigned  → en takeover / assign

import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap }             from 'rxjs/operators';
import { AnalyticsEventsService } from '../analytics-events/analytics-events.service.js';

@Injectable()
export class ConversationsAnalyticsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ConversationsAnalyticsInterceptor.name);

  constructor(private readonly analytics: AnalyticsEventsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req    = context.switchToHttp().getRequest<{
      method: string;
      url:    string;
      body:   Record<string, unknown>;
      user?:  { ecosystemId?: string; organizationId?: string };
    }>();

    const ecosystemId    = String(req.user?.ecosystemId    ?? '');
    const organizationId = String(req.user?.organizationId ?? '');

    return next.handle().pipe(
      tap((result: unknown) => {
        try {
          const res = result as Record<string, unknown> | null;
          if (!res || !ecosystemId || !organizationId) return;

          // POST /conversations → conversation.created
          if (req.method === 'POST' && req.url.includes('/conversations') && res['id']) {
            this.analytics.trackConversationCreated({
              ecosystemId,
              organizationId,
              conversationId: String(res['id']),
              channel:        String(res['channel'] ?? req.body['channel'] ?? 'UNKNOWN'),
              contactId:      String(res['contactId'] ?? ''),
            });
          }

          // PATCH /conversations/:id/resolve → conversation.resolved
          if (req.method === 'PATCH' && req.url.includes('/resolve') && res['id']) {
            this.analytics.trackConversationResolved({
              ecosystemId,
              organizationId,
              conversationId: String(res['id']),
              agentId:        String(res['assignedAgentId'] ?? ''),
            });
          }

          // PATCH /conversations/:id/takeover → conversation.assigned
          if (req.method === 'PATCH' && req.url.includes('/takeover') && res['id']) {
            this.analytics.trackConversationAssigned({
              ecosystemId,
              organizationId,
              conversationId: String(res['id']),
              agentId:        String(res['assignedAgentId'] ?? ''),
            });
          }
        } catch (e: unknown) {
          // Nunca romper el response por analytics
          this.logger.warn(`Analytics interceptor error (ignorado): ${String(e)}`);
        }
      }),
    );
  }
}
