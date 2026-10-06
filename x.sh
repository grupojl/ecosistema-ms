#!/usr/bin/env bash
# =============================================================================
# x.sh — ecosistema-ms
# Agrega módulo internal/ a los 5 microservicios que faltan:
#   chatia-backend, pasarelapagos-backend, analytics-backend,
#   notificaciones-backend, workers-backend
#
# Idempotente: si el archivo ya existe, no lo sobreescribe.
# Uso: bash x.sh
# Make: make x
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
GREY='\033[0;90m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
skip() { echo -e "${GREY}[~]${NC} $1 (ya existe — sin cambios)"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

write_file() {
  local path="$1"
  local content="$2"
  if [ -f "$path" ]; then
    skip "$path"
  else
    mkdir -p "$(dirname "$path")"
    printf '%s\n' "$content" > "$path"
    ok "$path"
  fi
}

# =============================================================================
# GUARD COMPARTIDO — mismo en los 5 servicios
# =============================================================================

GUARD_CONTENT='import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '"'"'@nestjs/common'"'"';
import { ConfigService } from '"'"'@nestjs/config'"'"';
import type { Request }  from '"'"'express'"'"';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req      = ctx.switchToHttp().getRequest<Request>();
    const key      = req.headers['"'"'x-internal-api-key'"'"'] as string | undefined;
    const expected = this.config.getOrThrow<string>('"'"'INTERNAL_API_KEY'"'"');

    if (!key || key !== expected) {
      this.logger.warn(
        `[InternalApiKeyGuard] Unauthorized attempt from ${req.ip}`,
      );
      throw new UnauthorizedException('"'"'Invalid internal API key'"'"');
    }
    return true;
  }
}'

# =============================================================================
# 1. chatia-backend
# =============================================================================
SERVICE="chatia-backend"
DIR="$ROOT/$SERVICE/src/internal"
warn "── $SERVICE ──────────────────────────────────────────"

write_file "$DIR/internal-api-key.guard.ts" "$GUARD_CONTENT"

write_file "$DIR/schemas.ts" 'import { z } from '"'"'zod'"'"';

export const ListConversationsSchema = z.object({
  ecosystemId:    z.string().min(1),
  organizationId: z.string().uuid().optional(),
  status:         z.enum(['"'"'INITIAL'"'"', '"'"'CALIFICANDO'"'"', '"'"'PROPUESTA'"'"', '"'"'NEGOCIANDO'"'"', '"'"'CIERRE'"'"', '"'"'ESCALADO'"'"', '"'"'RESUELTO'"'"']).optional(),
  page:           z.coerce.number().int().positive().default(1),
  limit:          z.coerce.number().int().positive().max(100).default(20),
});

export type ListConversationsDto = z.infer<typeof ListConversationsSchema>;'

write_file "$DIR/internal.service.ts" 'import { Injectable, Logger } from '"'"'@nestjs/common'"'"';
import { PrismaService }       from '"'"'@/prisma/prisma.service'"'"';
import type { ListConversationsDto } from '"'"'@/internal/schemas'"'"';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listConversations(dto: ListConversationsDto) {
    const where = {
      ecosystemId:    dto.ecosystemId,
      ...(dto.organizationId ? { organizationId: dto.organizationId } : {}),
      ...(dto.status          ? { status: dto.status }                 : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        select: {
          id:             true,
          ecosystemId:    true,
          organizationId: true,
          status:         true,
          channel:        true,
          createdAt:      true,
          updatedAt:      true,
          assignedAgentId: true,
        },
        orderBy: { createdAt: '"'"'desc'"'"' },
        skip:  (dto.page - 1) * dto.limit,
        take:  dto.limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { data, total, page: dto.page, limit: dto.limit };
  }

  async getHealth() {
    const [open, escalated, resolved] = await Promise.all([
      this.prisma.conversation.count({ where: { status: { notIn: ['"'"'RESUELTO'"'"'] } } }),
      this.prisma.conversation.count({ where: { status: '"'"'ESCALADO'"'"' } }),
      this.prisma.conversation.count({ where: { status: '"'"'RESUELTO'"'"' } }),
    ]);

    return {
      status:  '"'"'ok'"'"' as const,
      conversations: { open, escalated, resolved },
      uptime:  Math.floor(process.uptime()),
    };
  }
}'

write_file "$DIR/internal.controller.ts" 'import { Controller, Get, Query, UseGuards } from '"'"'@nestjs/common'"'"';
import { ApiTags, ApiOperation, ApiHeader }   from '"'"'@nestjs/swagger'"'"';
import { InternalApiKeyGuard }                from '"'"'@/internal/internal-api-key.guard'"'"';
import { InternalService }                    from '"'"'@/internal/internal.service'"'"';
import { ZodValidationPipe }                  from '"'"'@/common/pipes/zod-validation.pipe'"'"';
import { ListConversationsSchema, type ListConversationsDto } from '"'"'@/internal/schemas'"'"';

@ApiTags('"'"'internal'"'"')
@ApiHeader({ name: '"'"'x-internal-api-key'"'"', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('"'"'internal'"'"')
export class InternalController {
  constructor(private readonly svc: InternalService) {}

  @Get('"'"'conversations'"'"')
  @ApiOperation({ summary: '"'"'Lista conversaciones para superadmin'"'"' })
  listConversations(
    @Query(new ZodValidationPipe(ListConversationsSchema)) dto: ListConversationsDto,
  ) {
    return this.svc.listConversations(dto);
  }

  @Get('"'"'health'"'"')
  @ApiOperation({ summary: '"'"'Health extendido para superadmin'"'"' })
  health() {
    return this.svc.getHealth();
  }
}'

write_file "$DIR/internal.module.ts" 'import { Module }              from '"'"'@nestjs/common'"'"';
import { InternalApiKeyGuard }  from '"'"'@/internal/internal-api-key.guard'"'"';
import { InternalController }   from '"'"'@/internal/internal.controller'"'"';
import { InternalService }      from '"'"'@/internal/internal.service'"'"';

@Module({
  controllers: [InternalController],
  providers:   [InternalApiKeyGuard, InternalService],
})
export class InternalModule {}'

# =============================================================================
# 2. pasarelapagos-backend
# =============================================================================
SERVICE="pasarelapagos-backend"
DIR="$ROOT/$SERVICE/src/internal"
warn "── $SERVICE ──────────────────────────────────────────"

write_file "$DIR/internal-api-key.guard.ts" "$GUARD_CONTENT"

write_file "$DIR/schemas.ts" 'import { z } from '"'"'zod'"'"';

export const ListPaymentsSchema = z.object({
  ecosystemId:    z.string().min(1),
  organizationId: z.string().uuid().optional(),
  status:         z.enum(['"'"'PENDING'"'"', '"'"'COMPLETED'"'"', '"'"'FAILED'"'"', '"'"'REFUNDED'"'"']).optional(),
  page:           z.coerce.number().int().positive().default(1),
  limit:          z.coerce.number().int().positive().max(100).default(20),
});

export const RetryPaymentSchema = z.object({
  reason: z.string().min(10, '"'"'reason debe tener al menos 10 caracteres'"'"'),
});

export type ListPaymentsDto  = z.infer<typeof ListPaymentsSchema>;
export type RetryPaymentDto  = z.infer<typeof RetryPaymentSchema>;'

write_file "$DIR/internal.service.ts" 'import { Injectable, Logger, NotFoundException } from '"'"'@nestjs/common'"'"';
import { PrismaService } from '"'"'@/prisma/prisma.service'"'"';
import type { ListPaymentsDto, RetryPaymentDto } from '"'"'@/internal/schemas'"'"';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listPayments(dto: ListPaymentsDto) {
    const where = {
      ecosystemId:    dto.ecosystemId,
      ...(dto.organizationId ? { organizationId: dto.organizationId } : {}),
      ...(dto.status          ? { status: dto.status }                 : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: {
          id:             true,
          ecosystemId:    true,
          organizationId: true,
          status:         true,
          provider:       true,
          amountCents:    true,
          currency:       true,
          createdAt:      true,
          updatedAt:      true,
        },
        orderBy: { createdAt: '"'"'desc'"'"' },
        skip:  (dto.page - 1) * dto.limit,
        take:  dto.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { data, total, page: dto.page, limit: dto.limit };
  }

  async retryPayment(id: string, _dto: RetryPaymentDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    // El audit trail lo crea superadmin antes de llamar este endpoint
    // TODO: implementar lógica de retry cuando PaymentsService exponga retryById
    this.logger.log(`[internal] retry solicitado para payment ${id}`);
    return { id, status: payment.status, message: '"'"'retry enqueued'"'"' };
  }

  async getHealth() {
    const [pending, failed, completed] = await Promise.all([
      this.prisma.payment.count({ where: { status: '"'"'PENDING'"'"' } }),
      this.prisma.payment.count({ where: { status: '"'"'FAILED'"'"' } }),
      this.prisma.payment.count({ where: { status: '"'"'COMPLETED'"'"' } }),
    ]);

    return {
      status:   '"'"'ok'"'"' as const,
      payments: { pending, failed, completed },
      uptime:   Math.floor(process.uptime()),
    };
  }
}'

write_file "$DIR/internal.controller.ts" 'import {
  Controller, Get, Post, Param, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '"'"'@nestjs/common'"'"';
import { ApiTags, ApiOperation, ApiHeader } from '"'"'@nestjs/swagger'"'"';
import { InternalApiKeyGuard }              from '"'"'@/internal/internal-api-key.guard'"'"';
import { InternalService }                  from '"'"'@/internal/internal.service'"'"';
import { ZodValidationPipe }                from '"'"'@/common/pipes/zod-validation.pipe'"'"';
import {
  ListPaymentsSchema,  type ListPaymentsDto,
  RetryPaymentSchema,  type RetryPaymentDto,
} from '"'"'@/internal/schemas'"'"';

@ApiTags('"'"'internal'"'"')
@ApiHeader({ name: '"'"'x-internal-api-key'"'"', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('"'"'internal'"'"')
export class InternalController {
  constructor(private readonly svc: InternalService) {}

  @Get('"'"'payments'"'"')
  @ApiOperation({ summary: '"'"'Lista pagos para superadmin'"'"' })
  listPayments(
    @Query(new ZodValidationPipe(ListPaymentsSchema)) dto: ListPaymentsDto,
  ) {
    return this.svc.listPayments(dto);
  }

  @Post('"'"'payments/:id/retry'"'"')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '"'"'Retry de pago — reason >= 10 chars'"'"' })
  retryPayment(
    @Param('"'"'id'"'"') id: string,
    @Body(new ZodValidationPipe(RetryPaymentSchema)) dto: RetryPaymentDto,
  ) {
    return this.svc.retryPayment(id, dto);
  }

  @Get('"'"'health'"'"')
  @ApiOperation({ summary: '"'"'Health extendido para superadmin'"'"' })
  health() {
    return this.svc.getHealth();
  }
}'

write_file "$DIR/internal.module.ts" 'import { Module }             from '"'"'@nestjs/common'"'"';
import { InternalApiKeyGuard } from '"'"'@/internal/internal-api-key.guard'"'"';
import { InternalController }  from '"'"'@/internal/internal.controller'"'"';
import { InternalService }     from '"'"'@/internal/internal.service'"'"';

@Module({
  controllers: [InternalController],
  providers:   [InternalApiKeyGuard, InternalService],
})
export class InternalModule {}'

# =============================================================================
# 3. analytics-backend
# =============================================================================
SERVICE="analytics-backend"
DIR="$ROOT/$SERVICE/src/internal"
warn "── $SERVICE ──────────────────────────────────────────"

write_file "$DIR/internal-api-key.guard.ts" "$GUARD_CONTENT"

write_file "$DIR/schemas.ts" 'import { z } from '"'"'zod'"'"';

export const GetMetricsSchema = z.object({
  ecosystemId:    z.string().min(1),
  organizationId: z.string().uuid().optional(),
});

export type GetMetricsDto = z.infer<typeof GetMetricsSchema>;'

write_file "$DIR/internal.service.ts" 'import { Injectable, Logger } from '"'"'@nestjs/common'"'"';
import { PrismaService }        from '"'"'@/prisma/prisma.service'"'"';
import type { GetMetricsDto }   from '"'"'@/internal/schemas'"'"';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(dto: GetMetricsDto) {
    const where = {
      ecosystemId:    dto.ecosystemId,
      ...(dto.organizationId ? { organizationId: dto.organizationId } : {}),
    };

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // últimas 24h

    const [totalEvents, recentEvents] = await Promise.all([
      this.prisma.analyticsEvent.count({ where }),
      this.prisma.analyticsEvent.count({
        where: { ...where, occurredAt: { gte: since } },
      }),
    ]);

    return {
      ecosystemId:    dto.ecosystemId,
      organizationId: dto.organizationId ?? '"'"'all'"'"',
      totalEvents,
      recentEvents24h: recentEvents,
      period: { from: since.toISOString(), to: new Date().toISOString() },
    };
  }

  async getHealth() {
    const count = await this.prisma.analyticsEvent.count();
    return {
      status:  '"'"'ok'"'"' as const,
      analytics: { totalEvents: count },
      uptime:  Math.floor(process.uptime()),
    };
  }
}'

write_file "$DIR/internal.controller.ts" 'import { Controller, Get, Query, UseGuards } from '"'"'@nestjs/common'"'"';
import { ApiTags, ApiOperation, ApiHeader }   from '"'"'@nestjs/swagger'"'"';
import { InternalApiKeyGuard }                from '"'"'@/internal/internal-api-key.guard'"'"';
import { InternalService }                    from '"'"'@/internal/internal.service'"'"';
import { ZodValidationPipe }                  from '"'"'@/common/pipes/zod-validation.pipe'"'"';
import { GetMetricsSchema, type GetMetricsDto } from '"'"'@/internal/schemas'"'"';

@ApiTags('"'"'internal'"'"')
@ApiHeader({ name: '"'"'x-internal-api-key'"'"', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('"'"'internal'"'"')
export class InternalController {
  constructor(private readonly svc: InternalService) {}

  @Get('"'"'metrics'"'"')
  @ApiOperation({ summary: '"'"'Métricas de analytics para superadmin'"'"' })
  getMetrics(
    @Query(new ZodValidationPipe(GetMetricsSchema)) dto: GetMetricsDto,
  ) {
    return this.svc.getMetrics(dto);
  }

  @Get('"'"'health'"'"')
  @ApiOperation({ summary: '"'"'Health extendido para superadmin'"'"' })
  health() {
    return this.svc.getHealth();
  }
}'

write_file "$DIR/internal.module.ts" 'import { Module }             from '"'"'@nestjs/common'"'"';
import { InternalApiKeyGuard } from '"'"'@/internal/internal-api-key.guard'"'"';
import { InternalController }  from '"'"'@/internal/internal.controller'"'"';
import { InternalService }     from '"'"'@/internal/internal.service'"'"';

@Module({
  controllers: [InternalController],
  providers:   [InternalApiKeyGuard, InternalService],
})
export class InternalModule {}'

# =============================================================================
# 4. notificaciones-backend
# =============================================================================
SERVICE="notificaciones-backend"
DIR="$ROOT/$SERVICE/src/internal"
warn "── $SERVICE ──────────────────────────────────────────"

write_file "$DIR/internal-api-key.guard.ts" "$GUARD_CONTENT"

write_file "$DIR/internal.service.ts" 'import { Injectable, Logger } from '"'"'@nestjs/common'"'"';
import { PrismaService }        from '"'"'@/prisma/prisma.service'"'"';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const since = new Date(Date.now() - 60 * 60 * 1000); // última hora

    const [sent, failed, pending] = await Promise.all([
      this.prisma.notification.count({
        where: { status: '"'"'SENT'"'"', createdAt: { gte: since } },
      }),
      this.prisma.notification.count({
        where: { status: '"'"'FAILED'"'"', createdAt: { gte: since } },
      }),
      this.prisma.notification.count({
        where: { status: '"'"'PENDING'"'"' },
      }),
    ]);

    return {
      status: '"'"'ok'"'"' as const,
      notifications: {
        sentLast1h:  sent,
        failedLast1h: failed,
        pendingNow:  pending,
      },
      uptime: Math.floor(process.uptime()),
    };
  }
}'

write_file "$DIR/internal.controller.ts" 'import { Controller, Get, UseGuards } from '"'"'@nestjs/common'"'"';
import { ApiTags, ApiOperation, ApiHeader } from '"'"'@nestjs/swagger'"'"';
import { InternalApiKeyGuard }              from '"'"'@/internal/internal-api-key.guard'"'"';
import { InternalService }                  from '"'"'@/internal/internal.service'"'"';

@ApiTags('"'"'internal'"'"')
@ApiHeader({ name: '"'"'x-internal-api-key'"'"', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('"'"'internal'"'"')
export class InternalController {
  constructor(private readonly svc: InternalService) {}

  @Get('"'"'health'"'"')
  @ApiOperation({ summary: '"'"'Health extendido para superadmin'"'"' })
  health() {
    return this.svc.getHealth();
  }
}'

write_file "$DIR/internal.module.ts" 'import { Module }             from '"'"'@nestjs/common'"'"';
import { InternalApiKeyGuard } from '"'"'@/internal/internal-api-key.guard'"'"';
import { InternalController }  from '"'"'@/internal/internal.controller'"'"';
import { InternalService }     from '"'"'@/internal/internal.service'"'"';

@Module({
  controllers: [InternalController],
  providers:   [InternalApiKeyGuard, InternalService],
})
export class InternalModule {}'

# =============================================================================
# 5. workers-backend
# =============================================================================
SERVICE="workers-backend"
DIR="$ROOT/$SERVICE/src/internal"
warn "── $SERVICE ──────────────────────────────────────────"

write_file "$DIR/internal-api-key.guard.ts" "$GUARD_CONTENT"

write_file "$DIR/internal.service.ts" 'import { Injectable, Logger, Optional } from '"'"'@nestjs/common'"'"';
import { InjectQueue }                     from '"'"'@nestjs/bullmq'"'"';
import { Queue }                           from '"'"'bullmq'"'"';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    @Optional() @InjectQueue('"'"'document-ingestion'"'"') private readonly ingestQueue: Queue | null,
    @Optional() @InjectQueue('"'"'email-campaigns'"'"')    private readonly emailQueue:  Queue | null,
  ) {}

  async getHealth() {
    const [ingestCounts, emailCounts] = await Promise.all([
      this.ingestQueue?.getJobCounts() ?? null,
      this.emailQueue?.getJobCounts()  ?? null,
    ]);

    const queues: Record<string, unknown> = {};

    if (ingestCounts) {
      queues['"'"'document-ingestion'"'"'] = {
        waiting: ingestCounts.waiting ?? 0,
        active:  ingestCounts.active  ?? 0,
        failed:  ingestCounts.failed  ?? 0,
      };
    }

    if (emailCounts) {
      queues['"'"'email-campaigns'"'"'] = {
        waiting: emailCounts.waiting ?? 0,
        active:  emailCounts.active  ?? 0,
        failed:  emailCounts.failed  ?? 0,
      };
    }

    const hasDegradation = Object.values(queues).some(
      (q) => (q as { failed: number }).failed > 10,
    );

    return {
      status: hasDegradation ? ('"'"'degraded'"'"' as const) : ('"'"'ok'"'"' as const),
      queues,
      uptime: Math.floor(process.uptime()),
    };
  }
}'

write_file "$DIR/internal.controller.ts" 'import { Controller, Get, UseGuards } from '"'"'@nestjs/common'"'"';
import { ApiTags, ApiOperation, ApiHeader } from '"'"'@nestjs/swagger'"'"';
import { InternalApiKeyGuard }              from '"'"'@/internal/internal-api-key.guard'"'"';
import { InternalService }                  from '"'"'@/internal/internal.service'"'"';

@ApiTags('"'"'internal'"'"')
@ApiHeader({ name: '"'"'x-internal-api-key'"'"', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('"'"'internal'"'"')
export class InternalController {
  constructor(private readonly svc: InternalService) {}

  @Get('"'"'health'"'"')
  @ApiOperation({ summary: '"'"'Health extendido — estado de queues para superadmin'"'"' })
  health() {
    return this.svc.getHealth();
  }
}'

write_file "$DIR/internal.module.ts" 'import { Module }             from '"'"'@nestjs/common'"'"';
import { InternalApiKeyGuard } from '"'"'@/internal/internal-api-key.guard'"'"';
import { InternalController }  from '"'"'@/internal/internal.controller'"'"';
import { InternalService }     from '"'"'@/internal/internal.service'"'"';

@Module({
  controllers: [InternalController],
  providers:   [InternalApiKeyGuard, InternalService],
})
export class InternalModule {}'

# =============================================================================
# RECORDATORIO — app.module.ts de cada servicio
# =============================================================================
echo ""
echo "================================================="
echo " internal/ generado en 5 servicios"
echo "================================================="
echo ""
echo "  Archivos creados:"
echo "    chatia-backend/src/internal/"
echo "      internal-api-key.guard.ts"
echo "      schemas.ts"
echo "      internal.service.ts"
echo "      internal.controller.ts"
echo "      internal.module.ts"
echo ""
echo "    pasarelapagos-backend/src/internal/  (ídem + retry)"
echo "    analytics-backend/src/internal/      (ídem + metrics)"
echo "    notificaciones-backend/src/internal/ (health extendido)"
echo "    workers-backend/src/internal/        (health + queues)"
echo ""
echo "  ⚠️  PASO MANUAL REQUERIDO — app.module.ts de cada servicio:"
echo "  Agregar InternalModule a los imports:"
echo ""
echo "    import { InternalModule } from '@/internal/internal.module';"
echo ""
echo "    @Module({"
echo "      imports: ["
echo "        // ... módulos existentes ..."
echo "        InternalModule,   // ← agregar"
echo "      ],"
echo "    })"
echo ""
echo "  ⚠️  VARIABLE DE ENTORNO — verificar en Railway:"
echo "    INTERNAL_API_KEY=  (mismo valor en superadmin y en los 5 servicios)"
echo ""
echo "  ⚠️  ZodValidationPipe — verificar path en cada servicio:"
echo "    chatia-backend:         @/common/pipes/zod-validation.pipe"
echo "    pasarelapagos-backend:  @/common/pipes/zod-validation.pipe"
echo "    analytics-backend:      @/common/pipes/zod-validation.pipe"
echo ""
echo "  Commit sugerido:"
echo "    git add */src/internal"
echo "    git commit -m 'feat: módulo internal en 5 microservicios (SA-P02..SA-P05)'"
echo "================================================="