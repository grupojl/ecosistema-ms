// chatia-backend/src/ecosystem/ecosystem.controller.ts
// Migrado de class-validator → Zod inline (ADR-001)
// Protegido por x-platform-admin-key — NO usa TenantGuard.
import {
  Controller, Get, Post, Patch, Delete, Body,
  Param, Headers, ForbiddenException,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { EcosystemService }  from './ecosystem.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RegisterEcosystemSchema } from './schemas';
import type { RegisterEcosystemInput } from './schemas';

@ApiTags('ecosystem')
@ApiHeader({ name: 'x-platform-admin-key', required: true })
@Controller('api/v1/ecosystems')
export class EcosystemController {
  constructor(private readonly svc: EcosystemService) {}

  private guard(key: string | undefined): void {
    if (!key || key !== process.env.PLATFORM_ADMIN_KEY) {
      throw new ForbiddenException('Invalid platform admin key');
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nuevo ecosistema cliente' })
  register(
    @Headers('x-platform-admin-key') key: string,
    @Body(new ZodValidationPipe(RegisterEcosystemSchema)) dto: RegisterEcosystemInput,
  ) {
    this.guard(key);
    return this.svc.register(dto);
  }

  @Get()
  findAll(@Headers('x-platform-admin-key') key: string) {
    this.guard(key);
    return this.svc.findAll();
  }

  @Patch(':id/config')
  updateConfig(
    @Headers('x-platform-admin-key') key: string,
    @Param('id') id: string,
    @Body() config: Record<string, unknown>,
  ) {
    this.guard(key);
    return this.svc.updateConfig(id, config);
  }

  @Delete(':id')
  deactivate(
    @Headers('x-platform-admin-key') key: string,
    @Param('id') id: string,
  ) {
    this.guard(key);
    return this.svc.deactivate(id);
  }
}
