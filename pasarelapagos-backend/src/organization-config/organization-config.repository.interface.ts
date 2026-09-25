// pasarelapagos-backend/src/organization-config/organization-config.repository.interface.ts
import type { OrganizationProfile } from '../core/strategies/project-context.interface.js';

export const PAYMENT_ORG_CONFIG_REPO = Symbol('PAYMENT_ORG_CONFIG_REPO');

export interface StoredOrgConfig {
  id: string; organizationId: string; ecosystemId: string;
  plan: 'starter' | 'growth' | 'enterprise' | 'custom';
  featureFlags: Record<string, boolean>;
  limits:       Record<string, number>;
  timezone: string; locale: string;
  updatedAt: Date; createdAt: Date;
}

export interface UpsertOrgConfigInput {
  organizationId: string; ecosystemId: string;
  plan?:         StoredOrgConfig['plan'];
  featureFlags?: Partial<Record<string, boolean>>;
  limits?:       Partial<Record<string, number>>;
  timezone?:     string; locale?: string;
}

export interface IPaymentOrgConfigRepository {
  findByOrgId(ecosystemId: string, organizationId: string): Promise<StoredOrgConfig | null>;
  upsert(config: UpsertOrgConfigInput): Promise<StoredOrgConfig>;
}

export function toOrgProfile(stored: StoredOrgConfig): OrganizationProfile {
  return {
    organizationId: stored.organizationId,
    ecosystemId:    stored.ecosystemId,
    plan:           stored.plan,
    featureFlags: {
      stripeEnabled:        stored.featureFlags['stripeEnabled']        ?? false,
      mercadopagoEnabled:   stored.featureFlags['mercadopagoEnabled']   ?? true,
      dlocalEnabled:        stored.featureFlags['dlocalEnabled']        ?? false,
      installmentsEnabled:  stored.featureFlags['installmentsEnabled']  ?? false,
      autoRefundEnabled:    stored.featureFlags['autoRefundEnabled']    ?? false,
    },
    limits: {
      maxTransactionAmountCents: stored.limits['maxTransactionAmountCents'] ?? 1_000_000,
      maxAutoRetries:            stored.limits['maxAutoRetries']            ?? 3,
      reconciliationWindowHours: stored.limits['reconciliationWindowHours'] ?? 24,
    },
    timezone: stored.timezone, locale: stored.locale, updatedAt: stored.updatedAt,
  };
}
