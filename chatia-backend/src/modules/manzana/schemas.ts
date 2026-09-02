// chatia-backend/src/modules/manzana/schemas.ts
// Reemplaza EnrichContextDto de modules/manzana/dto/enrich-context.dto.ts
// TODO: agregar campos específicos del proyecto MANZANA cuando se integre.
import { z } from 'zod';

export const EnrichContextSchema = z.object({
  conversationId: z.string().min(1),
  organizationId: z.string().min(1),
  ecosystemId:    z.string().min(1),
  context:        z.record(z.unknown()).default({}),
  // TODO: agregar campos específicos de MANZANABusinessData
});

export type EnrichContextInput = z.infer<typeof EnrichContextSchema>;
