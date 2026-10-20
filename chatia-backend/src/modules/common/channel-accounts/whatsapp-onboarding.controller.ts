// src/modules/common/channel-accounts/whatsapp-onboarding.controller.ts
// Alta de WhatsApp por Embedded Signup (ADR-024). La organización sale del TenantGuard, nunca del body.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WhatsAppOnboardingService } from '@/core/channel-accounts/whatsapp-onboarding.service.js';
import {
  WhatsAppEmbeddedSignupSchema,
  type WhatsAppEmbeddedSignupInput,
} from '@/core/channel-accounts/schemas.js';
import { ZodValidationPipe } from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import { TenantGuard } from '@/infrastructure/common/guards/tenant.guard.js';
import { Tenant } from '@/infrastructure/common/decorators/tenant.decorator.js';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';

@Controller(['api/v1/channel-accounts/whatsapp', 'channel-accounts/whatsapp'])
@UseGuards(TenantGuard)
export class WhatsAppOnboardingController {
  constructor(private readonly svc: WhatsAppOnboardingService) {}

  @Post('embedded-signup')
  @HttpCode(HttpStatus.OK)
  connect(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(WhatsAppEmbeddedSignupSchema))
    dto: WhatsAppEmbeddedSignupInput,
  ) {
    return this.svc.connect(tenant.organizationId, tenant.role, dto);
  }

  @Get(':id/status')
  status(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.status(id, tenant.organizationId);
  }
}
