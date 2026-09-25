// pasarelapagos-backend/src/core/strategies/project-context.interface.ts
// ADR-019 v2 — ProjectStrategy org-aware para pagos.
// Los nombres de hooks son del DOMINIO de pagos (no copias de chatia).

export interface PaymentFeatureFlags {
  /** Stripe habilitado para esta org */
  stripeEnabled:        boolean;
  /** MercadoPago habilitado para esta org */
  mercadopagoEnabled:   boolean;
  /** dLocal habilitado (pagos internacionales) */
  dlocalEnabled:        boolean;
  /** Pagos en cuotas habilitados */
  installmentsEnabled:  boolean;
  /** Reembolsos automáticos habilitados */
  autoRefundEnabled:    boolean;
}

export interface PaymentLimits {
  /** Monto máximo por transacción (en centavos) */
  maxTransactionAmountCents: number;
  /** Máximo de reintentos automáticos */
  maxAutoRetries:            number;
  /** Ventana de reconciliación en horas */
  reconciliationWindowHours: number;
}

export interface OrganizationProfile {
  organizationId:  string;
  ecosystemId:     string;
  plan:            'starter' | 'growth' | 'enterprise' | 'custom';
  featureFlags:    PaymentFeatureFlags;
  limits:          PaymentLimits;
  timezone:        string;
  locale:          string;
  updatedAt:       Date;
}

export interface PaymentProjectContext {
  /** Provider preferido resuelto para esta org y país */
  preferredProvider:  string;
  /** Providers habilitados en orden de prioridad */
  enabledProviders:   string[];
  /** Monedas habilitadas para esta org */
  enabledCurrencies:  string[];
  /** Perfil de la organización */
  orgProfile:         OrganizationProfile;
  /** Datos de negocio específicos del ecosistema */
  businessData:       unknown;
}

export const DEFAULT_ORG_PROFILE: OrganizationProfile = {
  organizationId:  'unknown',
  ecosystemId:     'unknown',
  plan:            'starter',
  featureFlags: {
    stripeEnabled:        false,
    mercadopagoEnabled:   true,
    dlocalEnabled:        false,
    installmentsEnabled:  false,
    autoRefundEnabled:    false,
  },
  limits: {
    maxTransactionAmountCents: 10_000_00,  // 10.000 USD
    maxAutoRetries:            3,
    reconciliationWindowHours: 24,
  },
  timezone:  'America/Buenos_Aires',
  locale:    'es',
  updatedAt: new Date(0),
};
