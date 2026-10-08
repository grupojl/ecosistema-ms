// chatia-backend/src/assistant/assistant.controller.ts
// Migrado de class-validator ChatDto + UpdateAssistantConfigDto → Zod inline (ADR-001)
import {
  Controller, Get, Post, Put, Param,
  Body, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AssistantChatService }   from '@/core/assistant/chat/assistant-chat.service.js';
import { AssistantConfigService } from '@/core/assistant/config/assistant-config.service.js';
import { TenantGuard }            from '@/infrastructure/common/guards/tenant.guard.js';
import { Tenant }                 from '@/infrastructure/common/decorators/tenant.decorator.js';
import type { TenantContext }     from '@/infrastructure/common/types/tenant-context.js';
import { ZodValidationPipe }      from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import { ChatSchema, UpdateAssistantConfigSchema } from '@/core/assistant/schemas.js';
import type { ChatInput as ChatBody, UpdateAssistantConfigInput } from '@/core/assistant/schemas.js';

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('api/v1/assistant')
export class AssistantController {
  constructor(
    private readonly chat:   AssistantChatService,
    private readonly config: AssistantConfigService,
  ) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TenantGuard)
  async chatWithAssistant(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(ChatSchema)) dto: ChatBody,
  ) {
    return this.chat.chat({
      projectSlug:    dto.projectSlug,
      organizationId: tenant.organizationId,
      ecosystemId:    tenant.ecosystemId,
      userId:         dto.userId,
      message:        dto.message,
      channel:        dto.channel,
    });
  }

  @Get('config/:projectId')
  @UseGuards(TenantGuard)
  getConfig(@Param('projectId') projectId: string, @Tenant() tenant: TenantContext) {
    return this.config.getOrCreate(projectId, tenant.organizationId);
  }

  @Put('config/:projectId')
  @UseGuards(TenantGuard)
  updateConfig(
    @Param('projectId') projectId: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(UpdateAssistantConfigSchema)) dto: UpdateAssistantConfigInput,
  ) {
    return this.config.update(projectId, tenant.organizationId, dto);
  }
}
