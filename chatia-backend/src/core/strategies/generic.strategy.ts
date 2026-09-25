// chatia-backend/src/core/strategies/generic.strategy.ts
// Fallback garantizado. NUNCA crece con lógica de negocio real.
import { Injectable, Logger } from '@nestjs/common';
import {
  ProjectType, type ProjectStrategy,
  type ConversationEnrichInput, type ConversationResult,
} from './project-strategy.interface.js';
import {
  DEFAULT_ORG_PROFILE,
  type ProjectContext, type OrganizationProfile,
} from './project-context.interface.js';

@Injectable()
export class GenericStrategy implements ProjectStrategy {
  private readonly logger = new Logger(GenericStrategy.name);

  getProjectType(): ProjectType { return ProjectType.GENERIC; }

  async enrichConversationContext(input: ConversationEnrichInput): Promise<ProjectContext> {
    this.logger.debug(`GenericStrategy — ecosystemId=${input.ecosystemId} org=${input.organizationId}`);
    return {
      systemPrompt:   'Eres un asistente útil y amable.',
      defaultStage:   'INITIAL',
      preferredModel: 'llama-3.3-70b-versatile',
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
