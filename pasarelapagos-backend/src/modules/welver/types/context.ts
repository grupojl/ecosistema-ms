// pasarelapagos-backend/src/modules/welver/types/context.ts
// Datos de negocio para el routing de pagos de Welver por organización.
export interface WelverPaymentData {
  /** Provider preferido — puede ser sobrescrito por config de la org */
  preferredProvider:    'mercadopago' | 'stripe' | 'dlocal';
  /** País principal de operación — para routing */
  primaryCountry:       string;   // ISO 3166-1 alpha-2
  /** Cuotas máximas habilitadas (0 = sin cuotas) */
  maxInstallments:      number;
  /** Plan del merchant — afecta comisiones y providers disponibles */
  merchantPlan:         'free' | 'starter' | 'growth' | 'enterprise';
  /** Monedas habilitadas para esta org */
  enabledCurrencies:    string[];
}
