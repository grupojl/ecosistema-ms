// src/modules/common/channel-accounts/channel-accounts.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChannelAccountsService } from '@/core/channel-accounts/channel-accounts.service.js';
import { ZodValidationPipe } from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import {
  CreateChannelAccountSchema,
  UpdateChannelAccountSchema,
  type CreateChannelAccountInput,
  type UpdateChannelAccountInput,
} from '@/core/channel-accounts/schemas.js';
import { TenantGuard } from '@/infrastructure/common/guards/tenant.guard.js';
import { Tenant } from '@/infrastructure/common/decorators/tenant.decorator.js';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';

// api/v1/channel-accounts es la ruta coherente con el resto de la API (y con ai-config); la ruta sin prefijo se mantiene por compatibilidad
@Controller(['api/v1/channel-accounts', 'channel-accounts'])
@UseGuards(TenantGuard)
export class ChannelAccountsController {
  constructor(private readonly svc: ChannelAccountsService) {}

  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(CreateChannelAccountSchema))
    dto: CreateChannelAccountInput,
  ) {
    return this.svc.create(tenant.organizationId, dto);
  }

  @Get()
  list(@Tenant() tenant: TenantContext) {
    return this.svc.list(tenant.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.findOne(id, tenant.organizationId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(UpdateChannelAccountSchema))
    dto: UpdateChannelAccountInput,
  ) {
    return this.svc.update(id, tenant.organizationId, dto);
  }

  @Post(':id/rotate-token')
  rotateToken(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.rotateToken(id, tenant.organizationId);
  }
}
