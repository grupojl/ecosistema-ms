// chatia-backend/src/contacts/contacts.controller.ts
// Migrado de class-validator → Zod inline (ADR-001)
import {
  Controller, Get, Patch, Post, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService }    from './contacts.service';
import { TenantGuard }        from '../common/guards/tenant.guard';
import { Tenant }             from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';
import { ZodValidationPipe }  from '../common/pipes/zod-validation.pipe';
import {
  UpdateContactSchema, ListContactsSchema,
} from './schemas';
import type { UpdateContactInput, ListContactsInput } from './schemas';

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('api/v1/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(ListContactsSchema)) query: ListContactsInput,
  ) {
    return this.contactsService.list(tenant.organizationId, query);
  }

  @Get('stats')
  stats(@Tenant() tenant: TenantContext) {
    return this.contactsService.getStats(tenant.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.contactsService.findOne(id, tenant.organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(UpdateContactSchema)) dto: UpdateContactInput,
  ) {
    return this.contactsService.update(id, tenant.organizationId, dto);
  }
}
