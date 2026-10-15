// chatia-backend/src/modules/common/agents/agents.controller.ts
// Surface HTTP únicamente: valida, delega en AgentsService y devuelve. Sin Prisma ni reglas de negocio.
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AgentsService } from '@/core/agents/agents.service.js';
import { TenantGuard } from '@/infrastructure/common/guards/tenant.guard.js';
import { RolesGuard } from '@/infrastructure/common/guards/roles.guard.js';
import { Roles } from '@/infrastructure/common/decorators/roles.decorator.js';
import { Tenant } from '@/infrastructure/common/decorators/tenant.decorator.js';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';
import { ZodValidationPipe } from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import {
  RegisterAgentSchema,
  UpdateAgentSchema,
} from '@/core/agents/schemas.js';
import type {
  RegisterAgentInput,
  UpdateAgentInput,
} from '@/core/agents/schemas.js';

@ApiTags('agents')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('api/v1/agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Alta/actualización de perfil del agente autenticado (la identidad sale del token)',
  })
  register(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(RegisterAgentSchema)) dto: RegisterAgentInput,
  ) {
    return this.agents.register(tenant, dto);
  }

  @Get('me')
  me(@Tenant() tenant: TenantContext) {
    return this.agents.me(tenant);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  list(@Tenant() tenant: TenantContext) {
    return this.agents.list(tenant);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(UpdateAgentSchema)) dto: UpdateAgentInput,
  ) {
    return this.agents.update(id, tenant, dto);
  }
}
