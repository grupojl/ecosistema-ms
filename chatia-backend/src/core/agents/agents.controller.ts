// chatia-backend/src/agents/agents.controller.ts
import { randomUUID } from 'crypto';
import {
  Controller, Post, Get, Patch, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService }    from '@/infrastructure/prisma/prisma.service.js';
import { TenantGuard }      from '@/infrastructure/common/guards/tenant.guard.js';
import { RolesGuard }       from '@/infrastructure/common/guards/roles.guard.js';
import { Roles }            from '@/infrastructure/common/decorators/roles.decorator.js';
import { Tenant }           from '@/infrastructure/common/decorators/tenant.decorator.js';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';
import { ZodValidationPipe } from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import { RegisterAgentSchema, UpdateAgentSchema } from '@/core/agents/schemas.js';
import type { RegisterAgentInput, UpdateAgentInput } from '@/core/agents/schemas.js';

@ApiTags('agents')
@Controller('api/v1/agents')
export class AgentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registro de agente (primer login o por admin)' })
  async register(
    @Body(new ZodValidationPipe(RegisterAgentSchema)) dto: RegisterAgentInput,
  ) {
    return this.prisma.agent.upsert({
      where:  { firebaseUid: dto.firebaseUid },
      update: { name: dto.name, email: dto.email, avatarUrl: dto.avatarUrl },
      create: {
        id:             randomUUID(),
        firebaseUid:    dto.firebaseUid,
        name:           dto.name,
        email:          dto.email,
        avatarUrl:      dto.avatarUrl,
        organizationId: dto.organizationId ?? '',
      },
    });
  }

  @Get('me')
  @UseGuards(TenantGuard)
  @ApiBearerAuth()
  async me(@Tenant() tenant: TenantContext) {
    return this.prisma.agent.findFirst({
      where: { firebaseUid: tenant.firebaseUid, organizationId: tenant.organizationId },
    });
  }

  @Get()
  @UseGuards(TenantGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth()
  async list(@Tenant() tenant: TenantContext) {
    return this.prisma.agent.findMany({
      where: { organizationId: tenant.organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  @Patch(':id')
  @UseGuards(TenantGuard)
  @ApiBearerAuth()
  async update(
    @Param('id') id: string,
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(UpdateAgentSchema)) dto: UpdateAgentInput,
  ) {
    return this.prisma.agent.update({
      where: { id, organizationId: tenant.organizationId },
      data:  dto,
    });
  }
}
