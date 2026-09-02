// chatia-backend/src/internal/internal.controller.ts
// Migrado de class-validator → Zod inline (ADR-001)
// Protegido por InternalApiKeyGuard — sin Firebase, sin TenantGuard.
import {
  Body, Controller, Delete, Get,
  HttpCode, HttpStatus, Param, Post, UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InternalApiKeyGuard }  from './internal-api-key.guard';
import { AssistantChatService } from '../assistant/chat/assistant-chat.service';
import { ProjectsService }      from '../projects/projects.service';
import { ZodValidationPipe }    from '../common/pipes/zod-validation.pipe';
import { InternalChatSchema, InternalProjectSchema } from './schemas';
import type { InternalChatInput, InternalProjectInput } from './schemas';

@ApiTags('internal')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('internal')
export class InternalController {
  constructor(
    private readonly chatService:     AssistantChatService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar mensaje al asistente IA (uso interno)' })
  chat(@Body(new ZodValidationPipe(InternalChatSchema)) dto: InternalChatInput) {
    return this.chatService.chat(dto);
  }

  @Get(':organizationId/projects')
  listProjects(@Param('organizationId') organizationId: string) {
    return this.projectsService.findAll(organizationId);
  }

  @Post('projects')
  @HttpCode(HttpStatus.CREATED)
  createProject(
    @Body(new ZodValidationPipe(InternalProjectSchema)) dto: InternalProjectInput,
  ) {
    return this.projectsService.create(dto.organizationId, dto);
  }

  @Delete(':organizationId/projects/:slug')
  deleteProject(
    @Param('organizationId') organizationId: string,
    @Param('slug') slug: string,
  ) {
    return this.projectsService.removeBySlug(slug, organizationId);
  }

  @Get('ping')
  ping() { return { status: 'ok', service: 'chatia-backend' }; }
}
