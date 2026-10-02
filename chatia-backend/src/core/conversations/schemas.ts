// chatia-backend/src/conversations/schemas.ts
import { z } from 'zod';

export const ListConversationsSchema = z.object({
  status:           z.enum(['OPEN', 'ASSIGNED', 'HUMAN_TAKEOVER', 'RESOLVED', 'CLOSED']).optional(),
  channelAccountId: z.string().optional(),
  tag:              z.string().optional(),
  archived:         z.coerce.boolean().optional(),
  page:             z.coerce.number().int().positive().default(1),
});

export const SendMessageSchema = z.object({
  text: z.string().min(1).max(4096),
});

export const TakeoverSchema = z.object({
  agentId: z.string().min(1),
});

export const AddTagSchema = z.object({
  tag: z.string().min(1).max(50),
});

export type ListConversationsInput = z.infer<typeof ListConversationsSchema>;
export type SendMessageInput       = z.infer<typeof SendMessageSchema>;
export type TakeoverInput          = z.infer<typeof TakeoverSchema>;
export type AddTagInput            = z.infer<typeof AddTagSchema>;
