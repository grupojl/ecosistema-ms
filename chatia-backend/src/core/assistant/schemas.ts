// chatia-backend/src/assistant/schemas.ts
// Reemplaza ChatDto y UpdateAssistantConfigDto con class-validator
import { z } from 'zod';

export const ChatSchema = z.object({
  projectSlug: z.string().min(1).max(60),
  message:     z.string().min(1).max(4096),
  userId:      z.string().min(1),
  channel:     z.enum(['api', 'whatsapp', 'instagram', 'messenger', 'tiktok']).default('api'),
});

export const UpdateAssistantConfigSchema = z.object({
  personaName:              z.string().min(1).max(100).optional(),
  systemPrompt:             z.string().max(8000).optional(),
  groqModel:                z.string().optional(),
  temperature:              z.number().min(0).max(2).optional(),
  maxTokens:                z.number().int().min(256).max(4096).optional(),
  contextWindow:            z.number().int().min(1).max(50).optional(),
  welcomeMessage:           z.string().max(500).optional(),
  fallbackMessage:          z.string().max(500).optional(),
  allowedOrigins:           z.array(z.string()).optional(),
  useFaqFallback:           z.boolean().optional(),
  faqKbId:                  z.string().optional(),
  isEnabled:                z.boolean().optional(),
  humanTakeoverKeywords:    z.array(z.string()).optional(),
  autoResolveAfterHours:    z.number().int().min(1).max(168).optional(),
});

export type ChatInput                   = z.infer<typeof ChatSchema>;
export type UpdateAssistantConfigInput  = z.infer<typeof UpdateAssistantConfigSchema>;
