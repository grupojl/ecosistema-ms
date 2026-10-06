import { z } from 'zod';

export const GetMetricsSchema = z.object({
  ecosystemId:    z.string().min(1),
  organizationId: z.string().uuid().optional(),
});

export type GetMetricsDto = z.infer<typeof GetMetricsSchema>;
