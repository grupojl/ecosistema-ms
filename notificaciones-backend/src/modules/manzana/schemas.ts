// notificaciones-backend/src/modules/manzana/schemas.ts
import { z } from "zod";

export const SendNotificationSchema = z.object({
  recipientId:    z.string().min(1),
  organizationId: z.string().min(1),
  templateId:     z.string().min(1),
  data:           z.record(z.unknown()).optional(),
});

export type SendNotificationInput = z.infer<typeof SendNotificationSchema>;
