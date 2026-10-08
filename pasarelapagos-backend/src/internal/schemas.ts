import { z } from 'zod';

// Estados reales de PaymentStatus (prisma/schema.prisma)
export const PAYMENT_STATUSES = [
  'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED',
] as const;

export const ListPaymentsSchema = z.object({
  ecosystemId:    z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
  status:         z.enum(PAYMENT_STATUSES).optional(),
  page:           z.coerce.number().int().positive().default(1),
  limit:          z.coerce.number().int().min(1).max(100).default(20),
});

export const RetryPaymentSchema = z.object({
  reason: z.string().min(10, 'reason debe tener al menos 10 caracteres'),
});

export type ListPaymentsDto  = z.infer<typeof ListPaymentsSchema>;
export type RetryPaymentDto  = z.infer<typeof RetryPaymentSchema>;
