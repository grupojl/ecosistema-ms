// chatia-backend/src/ai-config/schemas.ts
// Reemplaza UpdateAiConfigDto con class-validator
import { z } from 'zod';

export const UpdateAiConfigSchema = z.object({
  systemPrompt:           z.string().max(8000).optional(),
  personaName:            z.string().min(1).max(100).optional(),
  groqModel:              z.string().optional(),
  temperature:            z.number().min(0).max(2).optional(),
  maxTokens:              z.number().int().min(256).max(4096).optional(),
  contextWindowSize:      z.number().int().min(1).max(50).optional(),
  humanTakeoverKeywords:  z.array(z.string().max(100)).optional(),
  autoResolveAfterHours:  z.number().int().min(1).max(168).optional(),
  welcomeMessage:         z.string().max(500).optional(),
  offlineMessage:         z.string().max(500).optional(),
});

export const ToggleAiSchema = z.object({
  enabled: z.boolean(),
});

export type UpdateAiConfigInput = z.infer<typeof UpdateAiConfigSchema>;
export type ToggleAiInput       = z.infer<typeof ToggleAiSchema>;
