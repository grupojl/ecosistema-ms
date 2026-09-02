// chatia-backend/src/agents/agents.controller.ts
// Migrado de class-validator → Zod inline (ADR-001)
import { randomUUID } from 'crypto';
import {
  Controller, Post, Get, Patch, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService }    from '../prisma/prisma.service';
import { TenantGuard }      from '../common/guards/tenant.guard';
import { RolesGuard }       from '../common/guards/roles.guard';
import { Roles }            from '../common/decorators/roles.decorator';
import { Tenant }           from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RegisterAgentSchema, UpdateAgentSchema } from './schemas';
import type { RegisterAgentInput, UpdateAgentInput } from './schemas';

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
      where: { firebaseUid: tenant.userId, organizationId: tenant.organizationId },
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
