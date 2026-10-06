import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { InternalApiKeyGuard }              from '@/internal/internal-api-key.guard';
import { InternalService }                  from '@/internal/internal.service';

@ApiTags('internal')
@ApiHeader({ name: 'x-internal-api-key', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly svc: InternalService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health extendido para superadmin' })
  health() {
    return this.svc.getHealth();
  }
}
