// pasarelapagos-backend/src/modules/payments/types/payment.types.ts
// PaymentOutput — tipo de salida del PaymentsService. — ADR-007
// El service ya tenia private serialize() haciendo este trabajo.
// Este archivo formaliza el tipo para que el controller lo use con inference.
import type { PaymentStatus, PaymentMethodKind } from '@prisma/client';

export interface PaymentOutput {
  id:              string;
  organizationId:  string;
  status:          PaymentStatus;
  amountMinor:     string;   // BigInt serializado como string — contrato del ecosistema
  currency:        string;
  country:         string;
  method:          PaymentMethodKind;
  providerId:      string;
  externalId:      string | null;
  description:     string | null;
  failureCode:     string | null;
  failureMessage:  string | null;
  idempotencyKey:  string;
  customerId:      string | null;
  createdAt:       Date;
  updatedAt:       Date;
}

export interface PaymentListOutput {
  items:  PaymentOutput[];
  total:  number;
  page:   number;
  limit:  number;
}

export interface RefundOutput {
  id:               string;
  paymentId:        string;
  amountMinor:      string;
  status:           string;
  externalRefundId: string | null;
  createdAt:        Date;
}
