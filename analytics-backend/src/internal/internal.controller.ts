import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader }   from '@nestjs/swagger';
import { InternalApiKeyGuard }                from '@/internal/internal-api-key.guard.js';
import { InternalService }                    from '@/internal/internal.service.js';
import { ZodValidationPipe }                  from '@/common/pipes/zod-validation.pipe.js';
import { GetMetricsSchema, type GetMetricsDto } from '@/internal/schemas.js';

@ApiTags('internal')
@ApiHeader({ name: 'x-internal-api-key', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly svc: InternalService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas de analytics para superadmin' })
  getMetrics(
    @Query(new ZodValidationPipe(GetMetricsSchema)) dto: GetMetricsDto,
  ) {
    return this.svc.getMetrics(dto);
  }

  @Get('health')
  @ApiOperation({ summary: 'Health extendido para superadmin' })
  health() {
    return this.svc.getHealth();
  }
}
