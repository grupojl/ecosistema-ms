// notificaciones-backend/src/notifications/schemas.ts
import { z } from 'zod';

const ChannelSchema = z.enum(['WHATSAPP', 'EMAIL', 'PUSH']);

export const EnqueueNotificationSchema = z.object({
  ecosystemId:    z.string().min(1),
  organizationId: z.string().min(1),
  contactId:      z.string().min(1),
  channel:        ChannelSchema,
  templateKey:    z.string().min(1),
  payload:        z.record(z.unknown()),
  idempotencyKey: z.string().optional(),
});

export type EnqueueNotificationInput = z.infer<typeof EnqueueNotificationSchema>;
