// pasarelapagos-backend/src/modules/mexus/types/context.ts
// TODO: completar cuando se integre Mexus.
export interface MexusPaymentData {
  preferredProvider: string;
  primaryCountry:    string;
  [key: string]: unknown;
}
