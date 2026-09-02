// chatia-backend/src/conversations/conversations.controller.ts
// Migrado de class-validator → Zod inline (ADR-001)
import {
  Controller, Get, Post, Patch, Delete, Body,
  Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { TenantGuard }          from '../common/guards/tenant.guard';
import { Tenant }               from '../common/decorators/tenant.decorator';
import type { TenantContext }   from '../common/types/tenant-context';
import { ZodValidationPipe }    from '../common/pipes/zod-validation.pipe';
import {
  ListConversationsSchema, SendMessageSchema,
  TakeoverSchema, AddTagSchema,
} from './schemas';
import type {
  ListConversationsInput, SendMessageInput,
  TakeoverInput, AddTagInput,
} from './schemas';

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('api/v1/conversations')
export class ConversationsController {
  constructor(private readonly svc: ConversationsService) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(ListConversationsSchema)) query: ListConversationsInput,
  ) {
    return this.svc.list(tenant.organizationId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.findOne(id, tenant.organizationId);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  sendMessage(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(SendMessageSchema)) dto: SendMessageInput,
  ) {
    return this.svc.sendManualMessage(id, tenant.organizationId, dto.text);
  }

  @Patch(':id/takeover')
  takeover(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(TakeoverSchema)) dto: TakeoverInput,
  ) {
    return this.svc.takeover(id, tenant.organizationId, dto.agentId);
  }

  @Patch(':id/release')
  release(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.release(id, tenant.organizationId);
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.resolve(id, tenant.organizationId);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.softDelete(id, tenant.organizationId);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.restore(id, tenant.organizationId);
  }

  @Post(':id/tags')
  @HttpCode(HttpStatus.OK)
  addTag(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(AddTagSchema)) dto: AddTagInput,
  ) {
    return this.svc.addTag(id, tenant.organizationId, dto.tag);
  }

  @Delete(':id/tags/:tag')
  removeTag(
    @Param('id') id: string,
    @Param('tag') tag: string,
    @Tenant() tenant: TenantContext,
  ) {
    return this.svc.removeTag(id, tenant.organizationId, tag);
  }
}
