import { Controller, Get } from '@nestjs/common';
import { SetMetadata }     from '@nestjs/common';
import { MetricsService }  from './metrics.service.js';

const Public = () => SetMetadata('isPublic', true);

@Controller('api/v1/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Public()
  snapshot() { return this.metrics.snapshot(); }
}
