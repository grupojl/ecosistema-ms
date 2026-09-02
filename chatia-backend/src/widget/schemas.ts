// chatia-backend/src/widget/schemas.ts
import { z } from 'zod';

export const WidgetChatSchema = z.object({
  message: z.string().min(1).max(2000),
  userId:  z.string().min(1).max(200).optional(),
  sessionId: z.string().uuid().optional(),
});

export type WidgetChatInput = z.infer<typeof WidgetChatSchema>;
