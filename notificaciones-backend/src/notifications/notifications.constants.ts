// notificaciones-backend/src/notifications/notifications.constants.ts

export const QUEUES = {
  WHATSAPP: 'notify.whatsapp',
  EMAIL:    'notify.email',
  PUSH:     'notify.push',
  DLQ:      'notify.dlq',
} as const;

export type NotifyQueue = (typeof QUEUES)[keyof typeof QUEUES];

export const QUEUE_DEFAULTS = {
  attempts: 5,
  backoff:  { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: 200,
  removeOnFail:     100,
} as const;
