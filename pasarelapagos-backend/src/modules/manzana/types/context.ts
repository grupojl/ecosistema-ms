// pasarelapagos-backend/src/modules/manzana/types/context.ts
// TODO: completar cuando se integre Manzana.
export interface ManzanaPaymentData {
  preferredProvider: string;
  primaryCountry:    string;
  [key: string]: unknown;
}
