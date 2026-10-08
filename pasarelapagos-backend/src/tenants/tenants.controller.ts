// pasarelapagos-backend/src/modules/tenants/tenants.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';
import { CreateApiKeySchema, type CreateApiKeyInput } from '@/tenants/schemas.js';
import { ZodValidationPipe } from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import { Tenant } from '@/infrastructure/common/decorators/tenant.decorator.js';
import type { TenantContext } from '@/infrastructure/common/decorators/tenant.decorator.js';
import { ApiKeyGuard } from '@/infrastructure/common/guards/api-key.guard.js';
import { ApiKeyService } from '@/tenants/api-key.service.js';

@ApiTags('tenants')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard)
@Controller({ path: 'tenants/me/api-keys', version: '1' })
export class TenantsController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  @Post()
  create(
    @Tenant() t: TenantContext,
    @Body(new ZodValidationPipe(CreateApiKeySchema)) dto: CreateApiKeyInput,
  ) {
    return this.apiKeys.create(t.id, dto.name, dto.expiresIn);
  }

  @Get()
  list(@Tenant() t: TenantContext) {
    return this.apiKeys.list(t.id);
  }

  @Delete(':keyId')
  revoke(@Tenant() t: TenantContext, @Param('keyId') keyId: string) {
    return this.apiKeys.revoke(keyId, t.id);
  }
}
