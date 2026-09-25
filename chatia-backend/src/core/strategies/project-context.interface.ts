// chatia-backend/src/core/strategies/project-context.interface.ts
// ADR-019 v2 — ProjectStrategy org-aware
// REGLA: solo tipos. Sin lógica de negocio.

export interface ChatFeatureFlags {
  aiAssistantEnabled:      boolean;
  faqEnabled:              boolean;
  multiChannelEnabled:     boolean;
  humanEscalationEnabled:  boolean;
  voiceEnabled:            boolean;
}

export interface ChatLimits {
  maxActiveConversations:      number;
  maxMessagesPerConversation:  number;
  inactivityTimeoutSeconds:    number;
  escalationAlertMinutes:      number;
}

export interface OrganizationProfile {
  organizationId:  string;
  ecosystemId:     string;
  plan:            'starter' | 'growth' | 'enterprise' | 'custom';
  featureFlags:    ChatFeatureFlags;
  limits:          ChatLimits;
  timezone:        string;
  locale:          string;
  updatedAt:       Date;
}

export interface ProjectContext {
  systemPrompt:   string;
  defaultStage:   string;
  preferredModel: string;
  useFaqFallback: boolean;
  orgProfile:     OrganizationProfile;
  businessData:   unknown;
}

export const DEFAULT_ORG_PROFILE: OrganizationProfile = {
  organizationId:  'unknown',
  ecosystemId:     'unknown',
  plan:            'starter',
  featureFlags: {
    aiAssistantEnabled:      true,
    faqEnabled:              false,
    multiChannelEnabled:     false,
    humanEscalationEnabled:  true,
    voiceEnabled:            false,
  },
  limits: {
    maxActiveConversations:      100,
    maxMessagesPerConversation:  200,
    inactivityTimeoutSeconds:    1800,
    escalationAlertMinutes:      60,
  },
  timezone:  'America/Buenos_Aires',
  locale:    'es',
  updatedAt: new Date(0),
};
