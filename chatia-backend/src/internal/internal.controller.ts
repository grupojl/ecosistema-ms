// chatia-backend/src/internal/internal.controller.ts
//
// Endpoints REST consumidos por grupojl-control (superadmin).
// Protegidos por InternalApiKeyGuard — sin Firebase ni TenantGuard.
//
// GET /internal/conversations/escalated
//   → conversaciones abiertas sin respuesta > N minutos (norte Intercom Admin)
//   → superadmin ve cuáles orgs tienen escalaciones pendientes
//
// GET /internal/conversations/stats
//   → totales por ecosistema para el dashboard de superadmin
import {
  Controller, Get, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { InternalApiKeyGuard }              from '@/internal/internal-api-key.guard.js';
import { PrismaService }                    from '@/prisma/prisma.service.js';
import { ZodValidationPipe }               from '@/common/pipes/zod-validation.pipe.js';
import { z }                               from 'zod';

// ── Schemas Zod ──────────────────────────────────────────────────────────────

const EscalatedConvsSchema = z.object({
  ecosystemId:             z.string().optional(),
  minutesWithoutResponse:  z.coerce.number().int().positive().default(60),
  limit:                   z.coerce.number().int().min(1).max(200).default(50),
});
type EscalatedConvsDto = z.infer<typeof EscalatedConvsSchema>;

const ConvsStatsSchema = z.object({
  ecosystemId: z.string(),
  from:        z.string().datetime().optional(),
  to:          z.string().datetime().optional(),
});
type ConvsStatsDto = z.infer<typeof ConvsStatsSchema>;

// ── Controller ───────────────────────────────────────────────────────────────

@ApiTags('internal')
@ApiHeader({ name: 'x-internal-api-key', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /internal/conversations/escalated ─────────────────────────────────
  @Get('conversations/escalated')
  @ApiOperation({ summary: 'Conversaciones escaladas sin respuesta > N minutos' })
  async escalated(
    @Query(new ZodValidationPipe(EscalatedConvsSchema)) dto: EscalatedConvsDto,
  ) {
    const cutoff = new Date(Date.now() - dto.minutesWithoutResponse * 60 * 1000);

    // Buscar conversaciones abiertas (OPEN status) con lastMessageAt antes del cutoff
    // La "escalada" en este contexto = abierta y sin respuesta del agente por > N min
    const convs = await this.prisma.conversation.findMany({
      where: {
        ...(dto.ecosystemId ? { ecosystemId: dto.ecosystemId } : {}),
        status:        'OPEN',
        updatedAt:     { lt: cutoff },
        assignedAgent: null,          // sin agente asignado = sin atención
      },
      select: {
        id:             true,
        ecosystemId:    true,
        organizationId: true,
        channelType:    true,
        updatedAt:      true,
        contact: {
          select: { name: true },
        },
      },
      orderBy: { updatedAt: 'asc' }, // más antigua primero
      take:    dto.limit,
    });

    return convs.map((c) => ({
      id:             c.id,
      ecosystemId:    c.ecosystemId,
      organizationId: c.organizationId,
      channel:        c.channelType,
      contactName:    c.contact?.name ?? 'Sin nombre',
      agentName:      null,
      lastMessageAt:  c.updatedAt.toISOString(),
      minutesWaiting: Math.floor((Date.now() - c.updatedAt.getTime()) / 60_000),
    }));
  }

  // ── GET /internal/conversations/stats ─────────────────────────────────────
  @Get('conversations/stats')
  @ApiOperation({ summary: 'Stats de conversaciones por ecosistema' })
  async stats(
    @Query(new ZodValidationPipe(ConvsStatsSchema)) dto: ConvsStatsDto,
  ) {
    const where = {
      ecosystemId: dto.ecosystemId,
      ...(dto.from || dto.to ? {
        createdAt: {
          ...(dto.from ? { gte: new Date(dto.from) } : {}),
          ...(dto.to   ? { lte: new Date(dto.to)   } : {}),
        },
      } : {}),
    };

    const [total, resolved, escalated] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.count({ where: { ...where, status: 'RESOLVED' } }),
      this.prisma.conversation.count({
        where: {
          ...where,
          status:        'OPEN',
          assignedAgent: null,
        },
      }),
    ]);

    return { total, resolved, escalated, avgResponseMinutes: 0 };
  }
}
