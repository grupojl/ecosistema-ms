// marketing-backend/src/infrastructure/contracts/pasarela-pagos.contract.ts
// Contrato de los eventos de conversión recibidos desde pasarelapagos-backend.
// El core de attribution consume esta interface — nunca el tipo raw de BullMQ.

export interface ConversionEvent {
  paymentId:      string;
  ecosystemId:    string;
  organizationId: string;
  revenue:        string;   // string para preservar precisión (BigInt serializado)
  currency:       string;
  occurredAt:     string;   // ISO 8601
}
