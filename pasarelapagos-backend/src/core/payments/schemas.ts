// pasarelapagos-backend/src/modules/payments/schemas.ts
// Reemplaza CreatePaymentDto y ListPaymentsDto con class-validator
import { z } from 'zod';

const PaymentMethodKindEnum = z.enum([
  'card', 'wallet', 'bank_transfer', 'cash_voucher', 'pix', 'qr',
]);

export const CreatePaymentSchema = z.object({
  amountMinor:    z.number().int().positive(),
  currency:       z.string().length(3).toUpperCase(),
  country:        z.string().length(2).toUpperCase(),
  method:         PaymentMethodKindEnum,
  description:    z.string().max(500).optional(),
  customerId:     z.string().min(1).optional(),
  metadata:       z.record(z.string()).default({}),
  returnUrl:      z.string().url().optional(),
  idempotencyKey: z.string().min(1).optional(), // si no viene, el controller genera uno
});

export const ListPaymentsSchema = z.object({
  status: z.enum([
    'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED',
  ]).optional(),
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const RefundSchema = z.object({
  amountMinor: z.number().int().positive().optional(), // null = refund total
  reason:      z.string().max(200).optional(),
});

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type ListPaymentsInput  = z.infer<typeof ListPaymentsSchema>;
export type RefundInput        = z.infer<typeof RefundSchema>;
