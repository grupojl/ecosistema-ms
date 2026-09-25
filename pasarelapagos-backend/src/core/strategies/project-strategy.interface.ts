// pasarelapagos-backend/src/core/strategies/project-strategy.interface.ts
// Hooks nombrados con dominio de PAGOS — no copias de chatia.
import type { PaymentProjectContext, OrganizationProfile } from './project-context.interface.js';

export enum ProjectType {
  WELVER  = 'welver',
  MANZANA = 'manzana',
  MEXUS   = 'mexus',
  GENERIC = 'generic',
}

export interface PaymentEnrichInput {
  organizationId:  string;
  ecosystemId:     string;
  country:         string;   // ISO 3166-1 alpha-2
  currency:        string;   // ISO 4217
  method:          string;   // 'card' | 'wallet' | 'pix' | etc.
  amountCents:     number;
}

export interface ChargeResult {
  organizationId:  string;
  ecosystemId:     string;
  paymentId:       string;
  provider:        string;
  status:          string;
  amountCents:     number;
  currency:        string;
  country:         string;
}

export interface PaymentProjectStrategy {
  /** Resuelve el provider y contexto ANTES de procesar el pago. NUNCA lanza. */
  enrichPaymentContext(input: PaymentEnrichInput): Promise<PaymentProjectContext>;
  /** Side-effects DESPUÉS del cobro (analytics, notifs, audit). NUNCA lanza. */
  afterChargeResult(result: ChargeResult, context: PaymentProjectContext): Promise<void>;
  getProjectType(): ProjectType;
  /** NUNCA lanza. */
  resolveOrgProfile(ecosystemId: string, organizationId: string): Promise<OrganizationProfile>;
}
