// chatia-backend/src/messages/messages.controller.ts
// Migrado de class-validator PaginationDto → Zod inline (ADR-001)
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth }                   from '@nestjs/swagger';
import { MessagesService }   from '@/messages/messages.service.js';
import { TenantGuard }       from '@/common/guards/tenant.guard.js';
import { Tenant }            from '@/common/decorators/tenant.decorator.js';
import type { TenantContext } from '@/common/types/tenant-context.js';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe.js';
import { PaginationSchema }  from '@/messages/schemas.js';
import type { PaginationInput } from '@/messages/schemas.js';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('api/v1')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations/:id/messages')
  list(
    @Param('id') conversationId: string,
    @Tenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationInput,
  ) {
    return this.messagesService.listByConversation(
      conversationId,
      tenant.organizationId,
      query.page,
      query.limit,
    );
  }

  @Get('messages/stats')
  stats(@Tenant() tenant: TenantContext) {
    return this.messagesService.getStats(tenant.organizationId);
  }
}
