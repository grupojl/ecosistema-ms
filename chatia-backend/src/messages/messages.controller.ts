// chatia-backend/src/messages/messages.controller.ts
// Migrado de class-validator PaginationDto → Zod inline (ADR-001)
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth }                   from '@nestjs/swagger';
import { MessagesService }   from './messages.service';
import { TenantGuard }       from '../common/guards/tenant.guard';
import { Tenant }            from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PaginationSchema }  from './schemas';
import type { PaginationInput } from './schemas';

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
