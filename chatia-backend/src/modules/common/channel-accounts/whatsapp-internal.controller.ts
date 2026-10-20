// src/modules/common/channel-accounts/whatsapp-internal.controller.ts
// Alta/estado/baja de WhatsApp para llamadas servicio-a-servicio (ADR-024, ADR-025 de ecosistema).
// El panel del dueño habla con sass-back por tRPC; sass-back ya validó rol OWNER y step-up, y llama acá con la
// clave interna. La organización viene en la ruta porque no hay token de usuario que la resuelva.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { WhatsAppOnboardingService } from '@/core/channel-accounts/whatsapp-onboarding.service.js';
import {
  WhatsAppEmbeddedSignupSchema,
  type WhatsAppEmbeddedSignupInput,
} from '@/core/channel-accounts/schemas.js';
import { EcosystemService } from '@/core/ecosystem/ecosystem.service.js';
import { InternalApiKeyGuard } from '@/infrastructure/transport/internal/internal-api-key.guard.js';
import { ZodValidationPipe } from '@/infrastructure/common/pipes/zod-validation.pipe.js';

const OrganizationIdSchema = z.string().min(1).max(64);

// La organización puede no haber entrado nunca al chat (TenantGuard la crea al primer acceso): se asegura acá.
const InternalConnectSchema = WhatsAppEmbeddedSignupSchema.extend({
  organizationName: z.string().min(1).max(200),
  organizationSlug: z.string().max(100).optional(),
});
type InternalConnectInput = z.infer<typeof InternalConnectSchema>;

@Controller('internal/whatsapp/:organizationId')
@UseGuards(InternalApiKeyGuard)
export class WhatsAppInternalController {
  constructor(
    private readonly svc: WhatsAppOnboardingService,
    private readonly ecosystems: EcosystemService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  current(
    @Param('organizationId', new ZodValidationPipe(OrganizationIdSchema))
    organizationId: string,
  ) {
    return this.svc.current(organizationId);
  }

  @Post('embedded-signup')
  @HttpCode(HttpStatus.OK)
  async connect(
    @Param('organizationId', new ZodValidationPipe(OrganizationIdSchema))
    organizationId: string,
    @Body(new ZodValidationPipe(InternalConnectSchema))
    dto: InternalConnectInput,
  ) {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const ecosystem = projectId
      ? await this.ecosystems.resolveByFirebaseProjectId(projectId)
      : null;
    if (!ecosystem?.isActive) {
      throw new ServiceUnavailableException(
        'El ecosistema de esta plataforma no está registrado en el chat',
      );
    }
    await this.ecosystems.ensureOrganization(
      ecosystem.id,
      organizationId,
      dto.organizationName,
      dto.organizationSlug,
    );

    const signup: WhatsAppEmbeddedSignupInput = {
      code: dto.code,
      wabaId: dto.wabaId,
      phoneNumberId: dto.phoneNumberId,
      name: dto.name,
    };
    // sass-back ya exigió OWNER (y step-up): el service vuelve a pedir rol, así que se declara explícitamente.
    return this.svc.connect(organizationId, 'OWNER', signup);
  }

  @Delete(':id')
  disconnect(
    @Param('organizationId', new ZodValidationPipe(OrganizationIdSchema))
    organizationId: string,
    @Param('id', new ZodValidationPipe(OrganizationIdSchema)) id: string,
  ) {
    return this.svc.disconnect(id, organizationId);
  }
}
