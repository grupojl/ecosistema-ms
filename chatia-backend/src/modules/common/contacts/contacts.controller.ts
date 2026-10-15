// chatia-backend/src/modules/common/contacts/contacts.controller.ts
// Migrado de class-validator → Zod inline (ADR-001)
import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService } from '@/core/contacts/contacts.service.js';
import { TenantGuard } from '@/infrastructure/common/guards/tenant.guard.js';
import { WritePermissionGuard } from '@/infrastructure/common/guards/write-permission.guard.js';
import { RolesGuard } from '@/infrastructure/common/guards/roles.guard.js';
import { Roles } from '@/infrastructure/common/decorators/roles.decorator.js';
import { RetentionService } from '@/core/privacy/retention.service.js';
import { Tenant } from '@/infrastructure/common/decorators/tenant.decorator.js';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';
import { ZodValidationPipe } from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import {
  UpdateContactSchema,
  ListContactsSchema,
} from '@/core/contacts/schemas.js';
import type {
  UpdateContactInput,
  ListContactsInput,
} from '@/core/contacts/schemas.js';

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('api/v1/contacts')
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly retention: RetentionService,
  ) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(ListContactsSchema)) query: ListContactsInput,
  ) {
    return this.contactsService.list(
      tenant.organizationId,
      tenant.ecosystemId,
      query,
    );
  }

  @Get('stats')
  stats(@Tenant() tenant: TenantContext) {
    return this.contactsService.getStats(
      tenant.organizationId,
      tenant.ecosystemId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.contactsService.findOne(
      id,
      tenant.organizationId,
      tenant.ecosystemId,
    );
  }

  /**
   * Derecho de supresión (a pedido del titular): borra el contacto y TODAS sus conversaciones, mensajes y sesiones.
   * IRREVERSIBLE. Solo OWNER/ADMIN con permiso de escritura, y solo sobre contactos de su organización.
   */
  @Delete(':id/data')
  @UseGuards(WritePermissionGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async erase(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return {
      success: true,
      data: await this.retention.eraseContact(tenant.organizationId, id),
    };
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(UpdateContactSchema)) dto: UpdateContactInput,
  ) {
    return this.contactsService.update(
      id,
      tenant.organizationId,
      tenant.ecosystemId,
      dto,
    );
  }
}
