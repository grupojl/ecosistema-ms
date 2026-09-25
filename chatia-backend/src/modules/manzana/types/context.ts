// chatia-backend/src/modules/manzana/types/context.ts
// TODO: completar campos cuando se integre el proyecto MANZANA.
export interface MANZANABusinessData {
  plan:              'free' | 'pro' | 'enterprise';
  organizationName:  string;
  hasProductCatalog: boolean;
  activeMarkets:     string[];
  [key: string]: unknown;
}
