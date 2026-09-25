// chatia-backend/src/modules/welver/welver.strategy.ts
// Strategy org-aware de Welver. NUNCA lanza en enrich/after.
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService }             from '../../prisma/prisma.service.js';
import { OrganizationConfigService } from '../../organization-config/organization-config.service.js';
import { ProjectStrategyRegistry }   from '../../core/strategies/project-strategy.registry.js';
import {
  ProjectType, type ProjectStrategy,
  type ConversationEnrichInput, type ConversationResult,
} from '../../core/strategies/project-strategy.interface.js';
import {
  DEFAULT_ORG_PROFILE, type ProjectContext, type OrganizationProfile,
} from '../../core/strategies/project-context.interface.js';
import { WELVER_CONFIG, buildWelverSystemPrompt } from './welver.config.js';
import type { WELVERBusinessData } from './types/context.js';

@Injectable()
export class WelverStrategy implements ProjectStrategy, OnModuleInit {
  private readonly logger = new Logger(WelverStrategy.name);

  constructor(
    private readonly registry:  ProjectStrategyRegistry,
    private readonly orgConfig: OrganizationConfigService,
    private readonly prisma:    PrismaService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('WelverStrategy registrada');
  }

  getProjectType(): ProjectType { return ProjectType.WELVER; }

  async enrichConversationContext(input: ConversationEnrichInput): Promise<ProjectContext> {
    try {
      const orgProfile = await this.orgConfig.resolve(input.ecosystemId, input.organizationId);
      const bizData    = await this.resolveBusinessData(input.ecosystemId, input.organizationId);
      const systemPrompt = buildWelverSystemPrompt(bizData, orgProfile);

      const assistantConfig = await this.prisma.assistantConfig.findFirst({
        where: { organizationId: input.organizationId, isEnabled: true },
        select: { groqModel: true },
      });

      return {
        systemPrompt,
        defaultStage:   WELVER_CONFIG.defaultStage,
        preferredModel: assistantConfig?.groqModel ?? WELVER_CONFIG.defaultModel,
        useFaqFallback: orgProfile.featureFlags.faqEnabled && bizData.hasProductCatalog,
        orgProfile,
        businessData:   bizData,
      };
    } catch (err: unknown) {
      this.logger.error(`WelverStrategy.enrich falló: ${err instanceof Error ? err.message : String(err)}`);
      return {
        systemPrompt:   'Eres un asistente amable.',
        defaultStage:   WELVER_CONFIG.defaultStage,
        preferredModel: WELVER_CONFIG.defaultModel,
        useFaqFallback: false,
        orgProfile:     { ...DEFAULT_ORG_PROFILE, organizationId: input.organizationId, ecosystemId: input.ecosystemId },
        businessData:   {} as WELVERBusinessData,
      };
    }
  }

  async afterConversationResult(result: ConversationResult, _context: ProjectContext): Promise<void> {
    try {
      if (result.escalated) {
        this.logger.log(`[welver] Escalación — conv=${result.conversationId} org=${result.organizationId}`);
        // TODO(ECO-H-04): notificaciones-backend cuando tenga /internal/notify-escalation
      }
      if (result.newStage && result.newStage !== 'INITIAL') {
        await this.prisma.conversation.updateMany({
          where: { id: result.conversationId, organizationId: result.organizationId },
          data:  { stage: result.newStage as never // @ecosistema-ms/jsonb-cast },
        });
      }
    } catch (err: unknown) {
      this.logger.error(`WelverStrategy.after falló: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async resolveOrgProfile(ecosystemId: string, organizationId: string): Promise<OrganizationProfile> {
    return this.orgConfig.resolve(ecosystemId, organizationId);
  }

  private async resolveBusinessData(ecosystemId: string, organizationId: string): Promise<WELVERBusinessData> {
    try {
      const ecosystem = await this.prisma.ecosystem.findFirst({
        where: { id: ecosystemId },
        select: { name: true, config: true },
      });
      const config = (ecosystem?.config as Record<string, unknown> // @ecosistema-ms/jsonb-cast | null) ?? {};

      const hasKb = await this.prisma.knowledgeBase.count({
        where: { organizationId, isActive: true },
      }) > 0;

      const agentsOnline = await this.prisma.conversation.count({
        where: { organizationId, assignedAgentId: { not: null }, status: 'OPEN' },
      }) > 0;

      return {
        merchantPlan:      (config['plan']      as WELVERBusinessData['merchantPlan']) ?? 'starter',
        storeName:         ecosystem?.name       ?? 'Tu tienda',
        storeCategory:     (config['category']  as string)   ?? 'general',
        activeMarkets:     (config['markets']   as string[]) ?? [],
        storeUrl:          (config['storeUrl']  as string | null) ?? null,
        hasProductCatalog: hasKb,
        humanAgentsOnline: agentsOnline,
      };
    } catch {
      return {
        merchantPlan: 'starter', storeName: 'Tu tienda', storeCategory: 'general',
        activeMarkets: [], storeUrl: null, hasProductCatalog: false, humanAgentsOnline: false,
      };
    }
  }
}
