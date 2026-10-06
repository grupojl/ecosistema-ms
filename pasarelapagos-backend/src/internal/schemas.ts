import { z } from 'zod';

export const ListPaymentsSchema = z.object({
  ecosystemId:    z.string().min(1),
  organizationId: z.string().uuid().optional(),
  status:         z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  page:           z.coerce.number().int().positive().default(1),
  limit:          z.coerce.number().int().positive().max(100).default(20),
});

export const RetryPaymentSchema = z.object({
  reason: z.string().min(10, 'reason debe tener al menos 10 caracteres'),
});

export type ListPaymentsDto  = z.infer<typeof ListPaymentsSchema>;
export type RetryPaymentDto  = z.infer<typeof RetryPaymentSchema>;
