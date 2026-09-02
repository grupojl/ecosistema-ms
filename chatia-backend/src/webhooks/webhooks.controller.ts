// chatia-backend/src/webhooks/webhooks.controller.ts
// Migrado de class-validator → Zod inline (ADR-001)
import {
  Controller, Get, Post, Patch, Delete, Body,
  Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth }    from '@nestjs/swagger';
import { WebhooksService }   from './webhooks.service';
import { TenantGuard }       from '../common/guards/tenant.guard';
import { Tenant }            from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateWebhookSchema, UpdateWebhookSchema } from './schemas';
import type { CreateWebhookInput, UpdateWebhookInput } from './schemas';

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('api/v1/webhooks')
export class WebhooksController {
  constructor(private readonly svc: WebhooksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(CreateWebhookSchema)) dto: CreateWebhookInput,
  ) {
    return this.svc.create(tenant.organizationId, dto);
  }

  @Get()
  findAll(@Tenant() tenant: TenantContext) {
    return this.svc.findAll(tenant.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.findOne(id, tenant.organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(UpdateWebhookSchema)) dto: UpdateWebhookInput,
  ) {
    return this.svc.update(id, tenant.organizationId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.remove(id, tenant.organizationId);
  }
}
