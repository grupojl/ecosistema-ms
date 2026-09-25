// chatia-backend/src/modules/welver/types/context.ts
// Contexto de negocio específico de WELVER (SaaS B2B — merchants).
export interface WELVERBusinessData {
  merchantPlan:      'free' | 'starter' | 'growth' | 'enterprise';
  storeName:         string;
  storeCategory:     string;
  activeMarkets:     string[];   // ISO 3166-1 alpha-2
  storeUrl:          string | null;
  hasProductCatalog: boolean;
  humanAgentsOnline: boolean;
}
