// chatia-backend/src/modules/mexus/mexus.strategy.ts
// Placeholder org-aware. Sigue el molde de WelverStrategy.
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { OrganizationConfigService } from '../../organization-config/organization-config.service.js';
import { ProjectStrategyRegistry }   from '../../core/strategies/project-strategy.registry.js';
import {
  ProjectType, type ProjectStrategy,
  type ConversationEnrichInput, type ConversationResult,
} from '../../core/strategies/project-strategy.interface.js';
import {
  DEFAULT_ORG_PROFILE, type ProjectContext, type OrganizationProfile,
} from '../../core/strategies/project-context.interface.js';
import type { MEXUSBusinessData } from './types/context.js';

@Injectable()
export class MexusStrategy implements ProjectStrategy, OnModuleInit {
  private readonly logger = new Logger(MexusStrategy.name);

  constructor(
    private readonly registry:  ProjectStrategyRegistry,
    private readonly orgConfig: OrganizationConfigService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('MexusStrategy registrada');
  }

  getProjectType(): ProjectType { return ProjectType.MEXUS; }

  async enrichConversationContext(input: ConversationEnrichInput): Promise<ProjectContext> {
    try {
      const orgProfile = await this.orgConfig.resolve(input.ecosystemId, input.organizationId);
      const bizData: MEXUSBusinessData = {
        plan:              'pro',
        organizationName:  input.organizationId,
        hasProductCatalog: orgProfile.featureFlags.faqEnabled,
        activeMarkets:     [],
      };
      return {
        systemPrompt:   'Eres un asistente de MEXUS. TODO: completar con instrucciones específicas.',
        defaultStage:   'INITIAL',
        preferredModel: 'llama-3.3-70b-versatile',
        useFaqFallback: orgProfile.featureFlags.faqEnabled,
        orgProfile,
        businessData:   bizData,
      };
    } catch (err: unknown) {
      this.logger.error(`MexusStrategy.enrich falló: ${err instanceof Error ? err.message : String(err)}`);
      return {
        systemPrompt: 'Eres un asistente amable.', defaultStage: 'INITIAL',
        preferredModel: 'llama-3.3-70b-versatile', useFaqFallback: false,
        orgProfile: { ...DEFAULT_ORG_PROFILE, organizationId: input.organizationId, ecosystemId: input.ecosystemId },
        businessData: {},
      };
    }
  }

  async afterConversationResult(_r: ConversationResult, _c: ProjectContext): Promise<void> {
    // TODO: side-effects específicos de Mexus
  }

  async resolveOrgProfile(ecosystemId: string, organizationId: string): Promise<OrganizationProfile> {
    return this.orgConfig.resolve(ecosystemId, organizationId);
  }
}
