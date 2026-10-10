// chatia-backend/src/core/strategies/generic.strategy.ts
// Fallback garantizado. NUNCA crece con lógica de negocio real.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ProjectStrategyRegistry } from '@/core/strategies/project-strategy.registry.js';
import {
  ProjectType, type ProjectStrategy,
  type ConversationEnrichInput, type ConversationResult,
} from '@/core/strategies/project-strategy.interface.js';
import {
  DEFAULT_ORG_PROFILE,
  type ProjectContext, type OrganizationProfile,
} from '@/core/strategies/project-context.interface.js';

@Injectable()
export class GenericStrategy implements ProjectStrategy, OnModuleInit {
  private readonly logger = new Logger(GenericStrategy.name);

  constructor(private readonly registry: ProjectStrategyRegistry) {}

  // El registry asume que GENERIC siempre está registrada (fallback de get()).
  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('GenericStrategy registrada');
  }

  getProjectType(): ProjectType { return ProjectType.GENERIC; }

  async enrichConversationContext(input: ConversationEnrichInput): Promise<ProjectContext> {
    this.logger.debug(`GenericStrategy — ecosystemId=${input.ecosystemId} org=${input.organizationId}`);
    return {
      systemPrompt:   'Eres un asistente útil y amable.',
      defaultStage:   'INITIAL',
      preferredModel: 'openai/gpt-oss-120b',
      useFaqFallback: false,
      orgProfile:     { ...DEFAULT_ORG_PROFILE, organizationId: input.organizationId, ecosystemId: input.ecosystemId },
      businessData:   {},
    };
  }

  async afterConversationResult(_r: ConversationResult, _c: ProjectContext): Promise<void> {
    // no-op
  }

  async resolveOrgProfile(ecosystemId: string, organizationId: string): Promise<OrganizationProfile> {
    return { ...DEFAULT_ORG_PROFILE, organizationId, ecosystemId };
  }
}
