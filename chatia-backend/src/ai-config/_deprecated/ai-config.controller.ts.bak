// chatia-backend/src/ai-config/ai-config.controller.ts
import {
  Controller, Get, Put, Patch, Body,
  Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth }  from '@nestjs/swagger';
import { AiConfigService }   from '@/ai-config/ai-config.service.js';
import { TenantGuard }       from '@/common/guards/tenant.guard.js';
import { Tenant }            from '@/common/decorators/tenant.decorator.js';
import type { TenantContext } from '@/common/types/tenant-context.js';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe.js';
import { UpdateAiConfigSchema, ToggleAiSchema } from '@/ai-config/schemas.js';
import type { UpdateAiConfigInput, ToggleAiInput } from '@/ai-config/schemas.js';

@ApiTags('ai-config')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('api/v1/channel-accounts/:accountId/ai-config')
export class AiConfigController {
  constructor(private readonly aiConfigService: AiConfigService) {}

  @Get()
  get(@Param('accountId') accountId: string, @Tenant() tenant: TenantContext) {
    return this.aiConfigService.getOrCreate(accountId, tenant.organizationId);
  }

  @Put()
  update(
    @Param('accountId') accountId: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(UpdateAiConfigSchema)) dto: UpdateAiConfigInput,
  ) {
    return this.aiConfigService.update(accountId, tenant.organizationId, dto as import("@prisma/client").Prisma.InputJsonValue);
  }

  @Patch('toggle')
  @HttpCode(HttpStatus.OK)
  toggle(
    @Param('accountId') accountId: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(ToggleAiSchema)) dto: ToggleAiInput,
  ) {
    return this.aiConfigService.toggleEnabled(accountId, tenant.organizationId, dto.enabled);
  }
}
