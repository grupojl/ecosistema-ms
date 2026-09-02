// chatia-backend/src/contacts/schemas.ts
import { z } from 'zod';

const ChannelTypeEnum = z.enum(['WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'TIKTOK', 'API']);

export const CreateContactSchema = z.object({
  channelType: ChannelTypeEnum,
  externalId:  z.string().min(1).max(255),
  name:        z.string().max(150).optional(),
  email:       z.string().email().optional(),
  phone:       z.string().max(30).optional(),
  username:    z.string().max(100).optional(),
  avatarUrl:   z.string().url().optional(),
  tags:        z.array(z.string()).default([]),
  metadata:    z.record(z.unknown()).default({}),
});

export const UpdateContactSchema = z.object({
  name:      z.string().max(150).optional(),
  email:     z.string().email().optional(),
  phone:     z.string().max(30).optional(),
  username:  z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
  optedOut:  z.boolean().optional(),
  tags:      z.array(z.string()).optional(),
  metadata:  z.record(z.unknown()).optional(),
});

export const ListContactsSchema = z.object({
  page:    z.coerce.number().int().positive().default(1),
  limit:   z.coerce.number().int().min(1).max(100).default(20),
  search:  z.string().optional(),
  optedOut: z.coerce.boolean().optional(),
  tag:     z.string().optional(),
});

export type CreateContactInput = z.infer<typeof CreateContactSchema>;
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;
export type ListContactsInput  = z.infer<typeof ListContactsSchema>;
