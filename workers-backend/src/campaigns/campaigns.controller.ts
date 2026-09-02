// workers-backend/src/campaigns/campaigns.controller.ts
// Migrado de class-validator → Zod inline (ADR-001)
import {
  Controller, Get, Post, Patch,
  Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CampaignsService }  from './campaigns.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CreateCampaignSchema } from './schemas.js';
import type { CreateCampaignInput } from './schemas.js';
import { z } from 'zod';

const PatchCampaignSchema = z.object({
  status: z.enum(['PAUSED', 'CANCELLED']).optional(),
  scheduledAt: z.coerce.date().optional(),
});
type PatchCampaignInput = z.infer<typeof PatchCampaignSchema>;

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('api/v1/campaigns')
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear campaña' })
  create(@Body(new ZodValidationPipe(CreateCampaignSchema)) dto: CreateCampaignInput) {
    return this.svc.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'organizationId', required: true })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @Query('organizationId') organizationId: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(organizationId, status);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.svc.findOne(id, organizationId);
  }

  @Patch(':id')
  patch(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
    @Body(new ZodValidationPipe(PatchCampaignSchema)) dto: PatchCampaignInput,
  ) {
    return this.svc.patch(id, organizationId, dto);
  }

  @Post(':id/dispatch')
  @HttpCode(HttpStatus.ACCEPTED)
  dispatch(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    void this.svc.findOne(id, organizationId);
    return this.svc.dispatch(id, organizationId);
  }
}
