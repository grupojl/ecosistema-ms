// workers-backend/src/internal/internal.controller.ts
//
// Endpoints REST para superadmin — DLQ viewer y retry de jobs.
// Norte: Datadog → DLQ > 100 jobs = alerta WARNING en Command Center.
//
// GET  /internal/jobs/dlq           → lista jobs fallidos por queue
// POST /internal/jobs/dlq/:id/retry → reintenta un job de DLQ
//
// DlqService ya tiene listAll() y retry() — los re-exponemos con auth interna.
import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { InternalApiKeyGuard }              from '@/internal/internal-api-key.guard.js';
import { DlqService }                       from '@/dlq/dlq.service.js';
import { ZodValidationPipe }                from '@/common/pipes/zod-validation.pipe.js';
import { z }                                from 'zod';

const ListDlqSchema = z.object({
  queue: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
type ListDlqDto = z.infer<typeof ListDlqSchema>;

const RetryJobSchema = z.object({
  reason: z.string().min(10, 'reason must be at least 10 characters'),
});
type RetryJobDto = z.infer<typeof RetryJobSchema>;

@ApiTags('internal')
@ApiHeader({ name: 'x-internal-api-key', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly dlq: DlqService) {}

  @Get('jobs/dlq')
  @ApiOperation({ summary: 'Lista jobs en DLQ para superadmin' })
  async listDlq(
    @Query(new ZodValidationPipe(ListDlqSchema)) dto: ListDlqDto,
  ) {
    // DlqService.listAll() devuelve todos los jobs fallidos
    const all = await this.dlq.listAll();
    const filtered = dto.queue
      ? all.filter((j: any) => j.queue === dto.queue)
      : all;
    return filtered.slice(0, dto.limit);
  }

  @Post('jobs/dlq/:queue/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reintenta un job fallido — reason >= 10 chars' })
  async retryJob(
    @Param('queue') queue: string,
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(RetryJobSchema)) dto: RetryJobDto,
  ) {
    await this.dlq.retry(queue, jobId);
    return { jobId, status: 'queued', reason: dto.reason };
  }
}
