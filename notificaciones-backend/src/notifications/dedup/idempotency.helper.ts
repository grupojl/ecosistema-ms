// notificaciones-backend/src/notifications/dedup/idempotency.helper.ts
import { createHash } from 'node:crypto';

export const DEDUP_WINDOWS: Record<string, number> = {
  'conversation.new': 5, 'message.new': 5, 'escalation': 10, 'campaign': 1440, 'default': 5,
};

export function buildIdempotencyKey(params: {
  eventType: string; contactId: string; organizationId: string; windowMinutes?: number;
}): string {
  const { eventType, contactId, organizationId } = params;
  const window  = params.windowMinutes ?? DEDUP_WINDOWS[eventType] ?? DEDUP_WINDOWS['default']!;
  const nowSlot = Math.floor(Date.now() / (window * 60 * 1_000));
  return createHash('sha256').update(`${eventType}:${contactId}:${organizationId}:${nowSlot}`).digest('hex');
}
