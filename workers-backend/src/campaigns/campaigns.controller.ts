// workers-backend/src/campaigns/campaigns.controller.ts

import {
  Controller, Get, Post, Patch,
  Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CampaignsService }    from './campaigns.service.js';
import { CreateCampaignDto, PatchCampaignDto } from './dto/campaign.dto.js';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('api/v1/campaigns')
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear campaña (DRAFT o SCHEDULED)' })
  create(@Body() dto: CreateCampaignDto) {
    return this.svc.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar campañas de una organización' })
  @ApiQuery({ name: 'organizationId', required: true })
  @ApiQuery({ name: 'status',         required: false })
  findAll(
    @Query('organizationId') organizationId: string,
    @Query('status')         status?:        string,
  ) {
    return this.svc.findAll(organizationId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una campaña' })
  findOne(
    @Param('id')             id: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.svc.findOne(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Pausar, reprogramar o cancelar campaña' })
  patch(
    @Param('id')             id:             string,
    @Query('organizationId') organizationId: string,
    @Body()                  dto:            PatchCampaignDto,
  ) {
    return this.svc.patch(id, organizationId, dto);
  }

  @Post(':id/dispatch')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Despachar campaña manualmente (sin esperar scheduledAt)' })
  dispatch(
    @Param('id')             id:             string,
    @Query('organizationId') organizationId: string,
  ) {
    void this.svc.findOne(id, organizationId); // validar ownership
    return this.svc.dispatchCampaign(id).then(() => ({ dispatched: true }));
  }
}
