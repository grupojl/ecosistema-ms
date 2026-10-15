// chatia-backend/src/core/widget/schemas.ts
import { z } from 'zod';

// El userId/sessionId ya no vienen del cliente: la identidad sale del token firmado (x-widget-token).
export const WidgetChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export type WidgetChatInput = z.infer<typeof WidgetChatSchema>;
