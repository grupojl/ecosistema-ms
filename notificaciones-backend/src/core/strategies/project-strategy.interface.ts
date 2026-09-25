// notificaciones-backend/src/core/strategies/project-strategy.interface.ts
import type { NotifProjectContext, OrganizationProfile } from './project-context.interface.js';

export enum ProjectType {
  WELVER = 'welver', MANZANA = 'manzana', MEXUS = 'mexus', GENERIC = 'generic',
}

export interface NotifEnrichInput {
  organizationId: string; ecosystemId: string;
  userId:         string;
  notificationType: string;
  channel?:       string;
}

export interface NotifSentResult {
  organizationId: string; ecosystemId: string;
  notificationId: string; userId: string;
  channel:        string; status: 'sent' | 'failed' | 'skipped';
}

export interface NotifProjectStrategy {
  /** NUNCA lanza */
  enrichNotifContext(input: NotifEnrichInput): Promise<NotifProjectContext>;
  /** NUNCA lanza */
  afterNotifSent(result: NotifSentResult, context: NotifProjectContext): Promise<void>;
  getProjectType(): ProjectType;
  /** NUNCA lanza */
  resolveOrgProfile(ecosystemId: string, organizationId: string): Promise<OrganizationProfile>;
}
