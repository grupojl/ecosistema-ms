// chatia-backend/src/projects/projects.controller.ts
// Migrado de class-validator → Zod inline (ADR-001)
import {
  Controller, Get, Post, Patch, Delete, Body,
  Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService }   from '@/core/projects/projects.service.js';
import { TenantGuard }       from '@/infrastructure/common/guards/tenant.guard.js';
import { Tenant }            from '@/infrastructure/common/decorators/tenant.decorator.js';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';
import { ZodValidationPipe } from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import { CreateProjectSchema, UpdateProjectSchema } from '@/core/projects/schemas.js';
import type { CreateProjectInput, UpdateProjectInput } from '@/core/projects/schemas.js';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private readonly svc: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(CreateProjectSchema)) dto: CreateProjectInput,
  ) {
    return this.svc.create(tenant.organizationId, dto);
  }

  @Get()
  findAll(@Tenant() tenant: TenantContext) {
    return this.svc.findAll(tenant.organizationId);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string, @Tenant() tenant: TenantContext) {
    return this.svc.findOne(slug, tenant.organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) dto: UpdateProjectInput,
  ) {
    return this.svc.update(id, tenant.organizationId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    return this.svc.remove(id, tenant.organizationId);
  }
}
