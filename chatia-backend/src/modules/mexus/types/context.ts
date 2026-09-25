// chatia-backend/src/modules/mexus/types/context.ts
// TODO: completar campos cuando se integre el proyecto MEXUS.
export interface MEXUSBusinessData {
  plan:              'free' | 'pro' | 'enterprise';
  organizationName:  string;
  hasProductCatalog: boolean;
  activeMarkets:     string[];
  [key: string]: unknown;
}
