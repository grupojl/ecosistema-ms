// chatia-backend/src/organization-config/organization-config.repository.interface.ts
import type { OrganizationProfile } from '../core/strategies/project-context.interface.js';

export const ORGANIZATION_CONFIG_REPO = Symbol('ORGANIZATION_CONFIG_REPO');

export interface StoredOrgConfig {
  id:              string;
  organizationId:  string;
  ecosystemId:     string;
  plan:            'starter' | 'growth' | 'enterprise' | 'custom';
  featureFlags:    Record<string, boolean>;
  limits:          Record<string, number>;
  timezone:        string;
  locale:          string;
  updatedAt:       Date;
  createdAt:       Date;
}

export interface UpsertOrgConfigInput {
  organizationId:  string;
  ecosystemId:     string;
  plan?:           StoredOrgConfig['plan'];
  featureFlags?:   Partial<Record<string, boolean>>;
  limits?:         Partial<Record<string, number>>;
  timezone?:       string;
  locale?:         string;
}

export interface IOrganizationConfigRepository {
  findByOrgId(ecosystemId: string, organizationId: string): Promise<StoredOrgConfig | null>;
  upsert(config: UpsertOrgConfigInput): Promise<StoredOrgConfig>;
  findAllByEcosystem(ecosystemId: string): Promise<StoredOrgConfig[]>;
}

export function toOrgProfile(stored: StoredOrgConfig): OrganizationProfile {
  return {
    organizationId:  stored.organizationId,
    ecosystemId:     stored.ecosystemId,
    plan:            stored.plan,
    featureFlags: {
      aiAssistantEnabled:      stored.featureFlags['aiAssistantEnabled']      ?? true,
      faqEnabled:              stored.featureFlags['faqEnabled']              ?? false,
      multiChannelEnabled:     stored.featureFlags['multiChannelEnabled']     ?? false,
      humanEscalationEnabled:  stored.featureFlags['humanEscalationEnabled']  ?? true,
      voiceEnabled:            stored.featureFlags['voiceEnabled']            ?? false,
    },
    limits: {
      maxActiveConversations:      stored.limits['maxActiveConversations']      ?? 100,
      maxMessagesPerConversation:  stored.limits['maxMessagesPerConversation']  ?? 200,
      inactivityTimeoutSeconds:    stored.limits['inactivityTimeoutSeconds']    ?? 1800,
      escalationAlertMinutes:      stored.limits['escalationAlertMinutes']      ?? 60,
    },
    timezone:  stored.timezone,
    locale:    stored.locale,
    updatedAt: stored.updatedAt,
  };
}
