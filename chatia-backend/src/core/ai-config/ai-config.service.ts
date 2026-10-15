// @ecosistema-ms/zod-migrated
// src/core/ai-config/ai-config.service.ts
import { Inject, Logger, Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateAiConfigInput } from '@/core/ai-config/schemas.js';
import {
  AI_CONFIG_REPOSITORY,
  type AiConfigUpdateData,
  type IAiConfigRepository,
} from '@/core/ai-config/repository/ai-config.repository.interface.js';

const DEFAULT_SYSTEM_PROMPT = `Sos un asistente virtual. Tu objetivo es atender consultas de forma amigable y profesional.

Reglas:
- Respondé siempre en español, de forma conversacional y breve
- Sé empático y proactivo en ofrecer ayuda`;

@Injectable()
export class AiConfigService {
  private readonly logger = new Logger(AiConfigService.name);
  constructor(
    @Inject(AI_CONFIG_REPOSITORY) private readonly repo: IAiConfigRepository,
  ) {}

  async getOrCreate(channelAccountId: string, organizationId: string) {
    await this.verifyOwnership(channelAccountId, organizationId);

    const existing = await this.repo.findByChannelAccount(channelAccountId);

    if (existing) return { success: true, data: existing };

    const created = await this.repo.create({
      channelAccountId,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      personaName: 'Asistente',
    });

    return { success: true, data: created };
  }

  async update(
    channelAccountId: string,
    organizationId: string,
    dto: UpdateAiConfigInput,
  ) {
    await this.verifyOwnership(channelAccountId, organizationId);

    // Solo se modifican los campos enviados
    const update = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as AiConfigUpdateData;

    const config = await this.repo.upsert(
      channelAccountId,
      {
        channelAccountId,
        systemPrompt: dto.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        personaName: dto.personaName ?? 'Asistente',
        groqModel: dto.groqModel ?? 'openai/gpt-oss-120b',
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.maxTokens ?? 1024,
        contextWindowSize: dto.contextWindowSize ?? 10,
        humanTakeoverKeywords: dto.humanTakeoverKeywords ?? [],
        autoResolveAfterHours: dto.autoResolveAfterHours ?? 24,
        welcomeMessage: dto.welcomeMessage,
        offlineMessage: dto.offlineMessage,
        isEnabled: dto.isEnabled ?? true,
      },
      update,
    );

    return { success: true, data: config };
  }

  async toggleEnabled(
    channelAccountId: string,
    organizationId: string,
    enabled: boolean,
  ) {
    await this.verifyOwnership(channelAccountId, organizationId);

    const config = await this.repo.setEnabled(channelAccountId, enabled);

    return {
      success: true,
      message: `IA ${enabled ? 'habilitada' : 'deshabilitada'} exitosamente`,
      data: config,
    };
  }

  private async verifyOwnership(
    channelAccountId: string,
    organizationId: string,
  ) {
    const owned = await this.repo.channelAccountBelongsTo(
      channelAccountId,
      organizationId,
    );
    if (!owned) throw new NotFoundException('Cuenta no encontrada');
  }
}
