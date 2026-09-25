// chatia-backend/src/core/strategies/project-strategy.interface.ts
// REGLA DURA: enrich* y after* NUNCA lanzan. Capturan, loguean, retornan neutro.

import type { ProjectContext, OrganizationProfile } from './project-context.interface.js';

export enum ProjectType {
  WELVER  = 'welver',
  MANZANA = 'manzana',
  MEXUS   = 'mexus',
  GENERIC = 'generic',
}

export interface ConversationEnrichInput {
  conversationId:  string;
  organizationId:  string;
  ecosystemId:     string;
  channel:         string;
  userMessage:     string;
  extra?:          Record<string, unknown>;
}

export interface ConversationResult {
  conversationId:   string;
  organizationId:   string;
  ecosystemId:      string;
  assistantMessage: string;
  newStage:         string;
  escalated:        boolean;
  metadata:         Record<string, unknown>;
}

export interface ProjectStrategy {
  /** NUNCA lanza — retorna contexto con defaults si falla */
  enrichConversationContext(input: ConversationEnrichInput): Promise<ProjectContext>;
  /** NUNCA lanza — solo loguea si falla */
  afterConversationResult(result: ConversationResult, context: ProjectContext): Promise<void>;
  getProjectType(): ProjectType;
  /** NUNCA lanza — retorna DEFAULT_ORG_PROFILE si falla */
  resolveOrgProfile(ecosystemId: string, organizationId: string): Promise<OrganizationProfile>;
}
