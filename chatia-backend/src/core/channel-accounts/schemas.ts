// chatia-backend/src/core/channel-accounts/schemas.ts
import { z } from 'zod';

const ChannelTypeSchema = z.enum([
  'WHATSAPP',
  'INSTAGRAM',
  'MESSENGER',
  'TIKTOK',
]);

export const CreateChannelAccountSchema = z.object({
  channelType: ChannelTypeSchema,
  name: z.string().min(1).max(100),
  externalId: z.string().min(1),
  accessToken: z.string().min(1),
  extraConfig: z.record(z.string(), z.unknown()).default({}),
  projectId: z.string().optional(),
});

// Embedded Signup: el SDK de Facebook en el dashboard entrega `code`, y el evento de sesión trae waba_id y phone_number_id.
// La identidad (organizationId) NUNCA viene en el body: sale del TenantGuard.
export const WhatsAppEmbeddedSignupSchema = z.object({
  code: z.string().min(1).max(2048),
  wabaId: z.string().regex(/^\d{5,30}$/, 'wabaId inválido'),
  phoneNumberId: z.string().regex(/^\d{5,30}$/, 'phoneNumberId inválido'),
  name: z.string().min(1).max(100).optional(),
});

export const UpdateChannelAccountSchema = CreateChannelAccountSchema.partial();

export type WhatsAppEmbeddedSignupInput = z.infer<
  typeof WhatsAppEmbeddedSignupSchema
>;
export type CreateChannelAccountInput = z.infer<
  typeof CreateChannelAccountSchema
>;
export type UpdateChannelAccountInput = z.infer<
  typeof UpdateChannelAccountSchema
>;
