// chatia-backend/src/faq/faq.controller.ts
// Migrado de class-validator → Zod inline (ADR-001)
import {
  Controller, Get, Post, Patch, Delete, Body,
  Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth }  from '@nestjs/swagger';
import { KnowledgeBaseService }  from './knowledge-base/knowledge-base.service';
import { KbDocumentService }     from './document/kb-document.service';
import { FaqQueryService }       from './query/faq-query.service';
import { TenantGuard }           from '../common/guards/tenant.guard';
import { Tenant }                from '../common/decorators/tenant.decorator';
import type { TenantContext }    from '../common/types/tenant-context';
import { ZodValidationPipe }     from '../common/pipes/zod-validation.pipe';
import {
  CreateKnowledgeBaseSchema, CreateKbDocumentSchema, FaqQuerySchema,
} from './schemas';
import type {
  CreateKnowledgeBaseInput, CreateKbDocumentInput, FaqQueryInput,
} from './schemas';

@ApiTags('faq')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('api/v1/faq')
export class FaqController {
  constructor(
    private readonly kb:    KnowledgeBaseService,
    private readonly doc:   KbDocumentService,
    private readonly query: FaqQueryService,
  ) {}

  // ── Knowledge Bases ────────────────────────────────────────────────────────

  @Post('knowledge-bases')
  @HttpCode(HttpStatus.CREATED)
  createKb(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(CreateKnowledgeBaseSchema)) dto: CreateKnowledgeBaseInput,
  ) {
    return this.kb.create(dto.projectId, tenant.organizationId, dto as never);
  }

  @Get('knowledge-bases')
  listKbs(@Tenant() tenant: TenantContext, @Param('projectId') projectId: string) {
    return this.kb.findAll(projectId, tenant.organizationId);
  }

  @Get('knowledge-bases/:kbId')
  getKb(@Param('kbId') kbId: string, @Tenant() tenant: TenantContext) {
    return this.kb.findOne(kbId, tenant.organizationId);
  }

  @Delete('knowledge-bases/:kbId')
  removeKb(@Param('kbId') kbId: string, @Tenant() tenant: TenantContext) {
    return this.kb.remove(kbId, tenant.organizationId);
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  @Post('knowledge-bases/:kbId/documents')
  @HttpCode(HttpStatus.CREATED)
  createDoc(
    @Param('kbId') kbId: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(CreateKbDocumentSchema)) dto: CreateKbDocumentInput,
  ) {
    return this.doc.create(kbId, tenant.organizationId, dto as never);
  }

  @Get('knowledge-bases/:kbId/documents')
  listDocs(@Param('kbId') kbId: string, @Tenant() tenant: TenantContext) {
    return this.doc.findAll(kbId, tenant.organizationId);
  }

  @Delete('documents/:docId')
  removeDoc(@Param('docId') docId: string, @Tenant() tenant: TenantContext) {
    return this.doc.remove(docId, tenant.organizationId);
  }

  @Patch('documents/:docId/reindex')
  reindex(@Param('docId') docId: string, @Tenant() tenant: TenantContext) {
    return this.doc.reindex(docId, tenant.organizationId);
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  @Post('query')
  @HttpCode(HttpStatus.OK)
  queryFaq(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(FaqQuerySchema)) dto: FaqQueryInput,
  ) {
    return this.query.answer(dto.kbId, dto.question, { topK: dto.topK });
  }
}
