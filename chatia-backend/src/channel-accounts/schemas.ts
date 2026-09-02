// chatia-backend/src/channel-accounts/schemas.ts
import { z } from 'zod';

const ChannelTypeSchema = z.enum(['WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'TIKTOK']);

export const CreateChannelAccountSchema = z.object({
  channelType:  ChannelTypeSchema,
  name:         z.string().min(1).max(100),
  externalId:   z.string().min(1),
  accessToken:  z.string().min(1),
  extraConfig:  z.record(z.unknown()).default({}),
  projectId:    z.string().optional(),
});

export const UpdateChannelAccountSchema = CreateChannelAccountSchema.partial();

export type CreateChannelAccountInput = z.infer<typeof CreateChannelAccountSchema>;
export type UpdateChannelAccountInput = z.infer<typeof UpdateChannelAccountSchema>;
