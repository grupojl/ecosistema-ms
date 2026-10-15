// chatia-backend/src/core/ai-config/repository/ai-config.repository.interface.ts
import type { AiConfig } from '@/generated/prisma/client.js';

export const AI_CONFIG_REPOSITORY = Symbol('AI_CONFIG_REPOSITORY');

/** Campos de AiConfig que el service completa con sus valores por defecto al crear. */
export interface AiConfigCreateData {
  channelAccountId: string;
  systemPrompt: string;
  personaName: string;
  groqModel?: string;
  temperature?: number;
  maxTokens?: number;
  contextWindowSize?: number;
  humanTakeoverKeywords?: string[];
  autoResolveAfterHours?: number;
  welcomeMessage?: string;
  offlineMessage?: string;
  isEnabled?: boolean;
}

export type AiConfigUpdateData = Partial<
  Omit<AiConfigCreateData, 'channelAccountId'>
>;

export interface IAiConfigRepository {
  /** ¿La cuenta de canal es de esta organización? (ownership antes de leer o escribir su configuración) */
  channelAccountBelongsTo(
    channelAccountId: string,
    organizationId: string,
  ): Promise<boolean>;
  findByChannelAccount(channelAccountId: string): Promise<AiConfig | null>;
  create(data: AiConfigCreateData): Promise<AiConfig>;
  upsert(
    channelAccountId: string,
    create: AiConfigCreateData,
    update: AiConfigUpdateData,
  ): Promise<AiConfig>;
  setEnabled(channelAccountId: string, enabled: boolean): Promise<AiConfig>;
}
