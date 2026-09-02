// pasarelapagos-backend/src/modules/payments/repository/payments.repository.interface.ts
import type { Payment, PaymentStatus } from '../domain/payment.entity.js';

export const PAYMENTS_REPOSITORY = Symbol('PAYMENTS_REPOSITORY');

export interface CreatePaymentInput {
  tenantId:       string;
  organizationId: string;
  amountMinor:    bigint;
  currency:       string;
  country:        string;
  method:         string;
  providerId:     string;
  idempotencyKey: string;
  description?:   string;
  customerId?:    string;
  metadata?:      Record<string, string>;
}

export interface ListPaymentsFilter {
  organizationId: string;
  tenantId:       string;
  status?:        PaymentStatus;
  page?:          number;
  limit?:         number;
}

export interface IPaymentsRepository {
  findById(id: string, organizationId: string): Promise<Payment | null>;
  findByIdempotencyKey(key: string, organizationId: string): Promise<Payment | null>;
  list(filter: ListPaymentsFilter): Promise<{ data: Payment[]; total: number; page: number }>;
  create(input: CreatePaymentInput): Promise<Payment>;
  updateStatus(
    id:             string,
    organizationId: string,
    status:         PaymentStatus,
    extra?:         Partial<Pick<Payment, 'externalId' | 'failureCode' | 'failureMessage'>>,
  ): Promise<Payment>;
}
