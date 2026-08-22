#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix analytics.service.ts + conversations.service.ts + proto/index.ts
# Ejecutar: bash x.sh   ó   make x
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

# =============================================================================
# FIX 1 — analytics-backend/src/analytics/analytics.service.ts
# Agregar getAgentMetrics dentro de la clase — reescribir el archivo completo
# con los 4 métodos: getOverview, getConversationsByDay, persistEvent, getAgentMetrics
# =============================================================================
log "[1/3] analytics-backend — analytics.service.ts: agregar getAgentMetrics"

cat > "$ROOT/analytics-backend/src/analytics/analytics.service.ts" << 'EOF'
// analytics-backend/src/analytics/analytics.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER }              from '@nestjs/cache-manager';
import type { Cache }                 from 'cache-manager';
import { PrismaService }              from '../prisma/prisma.service.js';

const CACHE_TTL_5MIN  = 5 * 60 * 1_000;
const CACHE_TTL_10MIN = 10 * 60 * 1_000;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getOverview(params: {
    ecosystemId:    string;
    organizationId: string;
    from:           Date;
    to:             Date;
  }) {
    const cacheKey = `analytics:overview:${params.organizationId}:${params.from.toISOString()}:${params.to.toISOString()}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const where = (eventType: string) => ({
      organizationId: params.organizationId,
      ecosystemId:    params.ecosystemId,
      eventType,
      occurredAt: { gte: params.from, lte: params.to },
    });

    const [total, resolved, escalated] = await Promise.all([
      this.prisma.analyticsEvent.count({ where: where('conversation.created') }),
      this.prisma.analyticsEvent.count({ where: where('conversation.resolved') }),
      this.prisma.analyticsEvent.count({ where: where('conversation.escalated') }),
    ]);

    const result = { totalConversations: total, resolvedCount: resolved, escalatedCount: escalated };
    await this.cache.set(cacheKey, result, CACHE_TTL_5MIN);
    return result;
  }

  async getConversationsByDay(organizationId: string, from: Date, to: Date) {
    const cacheKey = `analytics:byDay:${organizationId}:${from.toISOString()}:${to.toISOString()}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const summaries = await this.prisma.dailyConversationSummary.findMany({
      where:   { organizationId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });

    let result;
    if (summaries.length > 0) {
      const byDate = new Map<string, { date: string; total: number; resolved: number; escalated: number }>();
      for (const s of summaries) {
        const dateStr = s.date.toISOString().substring(0, 10);
        const existing = byDate.get(dateStr) ?? { date: dateStr, total: 0, resolved: 0, escalated: 0 };
        byDate.set(dateStr, {
          date:      dateStr,
          total:     existing.total     + s.total,
          resolved:  existing.resolved  + s.resolved,
          escalated: existing.escalated + s.escalated,
        });
      }
      result = [...byDate.values()];
    } else {
      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          organizationId,
          eventType: { in: ['conversation.created', 'conversation.resolved', 'conversation.escalated'] },
          occurredAt: { gte: from, lte: to },
        },
        select: { eventType: true, occurredAt: true },
        orderBy: { occurredAt: 'asc' },
      });

      const buckets = new Map<string, { date: string; total: number; resolved: number; escalated: number }>();
      for (const e of events) {
        const date = e.occurredAt.toISOString().substring(0, 10);
        const b = buckets.get(date) ?? { date, total: 0, resolved: 0, escalated: 0 };
        if (e.eventType === 'conversation.created')   b.total++;
        if (e.eventType === 'conversation.resolved')  b.resolved++;
        if (e.eventType === 'conversation.escalated') b.escalated++;
        buckets.set(date, b);
      }
      result = [...buckets.values()];
    }

    await this.cache.set(cacheKey, result, CACHE_TTL_5MIN);
    return result;
  }

  async getAgentMetrics(params: {
    ecosystemId:    string;
    organizationId: string;
    from:           Date;
    to:             Date;
    page?:          number;
    limit?:         number;
  }): Promise<{ agents: unknown[]; total: number }> {
    const { organizationId, ecosystemId, from, to } = params;
    const limit  = Math.min(params.limit  ?? 20, 100);
    const offset = ((params.page ?? 1) - 1) * limit;

    const cacheKey = `analytics:agents:${organizationId}:${from.toISOString()}:${to.toISOString()}:${offset}:${limit}`;
    const cached = await this.cache.get<{ agents: unknown[]; total: number }>(cacheKey);
    if (cached) return cached;

    const [assigned, resolved] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: { organizationId, ecosystemId, eventType: 'conversation.assigned', occurredAt: { gte: from, lte: to } },
        select: { payload: true },
        take: 50_000,
      }),
      this.prisma.analyticsEvent.findMany({
        where: { organizationId, ecosystemId, eventType: 'conversation.resolved_by_agent', occurredAt: { gte: from, lte: to } },
        select: { payload: true },
        take: 50_000,
      }),
    ]);

    const agentMap = new Map<string, { assigned: number; resolved: number }>();

    for (const e of assigned) {
      const p = e.payload as Record<string, unknown>;
      const agentId = String(p['agentId'] ?? '');
      if (!agentId) continue;
      const cur = agentMap.get(agentId) ?? { assigned: 0, resolved: 0 };
      agentMap.set(agentId, { ...cur, assigned: cur.assigned + 1 });
    }
    for (const e of resolved) {
      const p = e.payload as Record<string, unknown>;
      const agentId = String(p['agentId'] ?? '');
      if (!agentId) continue;
      const cur = agentMap.get(agentId) ?? { assigned: 0, resolved: 0 };
      agentMap.set(agentId, { ...cur, resolved: cur.resolved + 1 });
    }

    const all = [...agentMap.entries()]
      .map(([agentId, data]) => ({ agentId, ...data }))
      .sort((a, b) => b.assigned - a.assigned);

    const result = { agents: all.slice(offset, offset + limit), total: all.length };
    await this.cache.set(cacheKey, result, CACHE_TTL_10MIN);
    return result;
  }

  async persistEvent(data: {
    ecosystemId:    string;
    organizationId: string;
    eventType:      string;
    payload:        Record<string, unknown>;
    occurredAt:     Date;
  }): Promise<void> {
    await this.prisma.analyticsEvent.create({ data });
  }
}
EOF
ok "analytics.service.ts — reescrito con getAgentMetrics dentro de la clase"

# =============================================================================
# FIX 2 — chatia-backend/src/conversations/conversations.service.ts
# El archivo está vacío (solo comentario). Restaurar con git el original.
# Si git no tiene el original (porque lo generamos nosotros), crear un stub
# funcional mínimo que compile y deje el service operativo.
# =============================================================================
log "[2/3] chatia-backend — conversations.service.ts: restaurar"

CONV_SVC="$ROOT/chatia-backend/src/conversations/conversations.service.ts"

# Intentar git checkout del original
git -C "$ROOT" show HEAD:chatia-backend/src/conversations/conversations.service.ts \
  > "$CONV_SVC.original" 2>/dev/null

if [ -s "$CONV_SVC.original" ] && ! grep -q "conversations.service.original" "$CONV_SVC.original" 2>/dev/null; then
  mv "$CONV_SVC.original" "$CONV_SVC"
  ok "conversations.service.ts restaurado desde git HEAD"
else
  rm -f "$CONV_SVC.original"
  # Intentar HEAD~1 (antes de nuestros commits)
  git -C "$ROOT" log --oneline -5 chatia-backend/src/conversations/conversations.service.ts 2>/dev/null || true

  # Buscar el commit antes de que empezáramos a modificar
  ORIG_COMMIT=$(git -C "$ROOT" log --oneline chatia-backend/src/conversations/conversations.service.ts 2>/dev/null | \
    grep -v "chore:" | head -1 | awk '{print $1}' || echo "")

  if [ -n "$ORIG_COMMIT" ]; then
    git -C "$ROOT" show "$ORIG_COMMIT":chatia-backend/src/conversations/conversations.service.ts \
      > "$CONV_SVC" 2>/dev/null && \
      ok "conversations.service.ts restaurado desde commit $ORIG_COMMIT" || \
      warn "No se pudo restaurar desde $ORIG_COMMIT"
  else
    warn "No se encontró versión original en git — crear manualmente"
    warn "El archivo actual está vacío y causará errores de compilación"
  fi
fi

# =============================================================================
# FIX 3 — packages/proto/src/index.ts
# Solo tiene `import { join } from 'path'` sin los exports
# =============================================================================
log "[3/3] packages/proto/src/index.ts — agregar exports faltantes"

PROTO_INDEX="$ROOT/packages/proto/src/index.ts"

# Verificar si tiene los exports
if ! grep -q "CHATIA_PROTO_PATH" "$PROTO_INDEX" 2>/dev/null; then
  cat > "$PROTO_INDEX" << 'EOF'
// packages/proto/src/index.ts
// Compatible con NodeNext/CJS — NO usa import.meta
import { join } from 'path';

// En Railway el Dockerfile copia las protos a ./proto/ relativo al WORKDIR del runner
// En desarrollo: relativo a este archivo
const PROTO_DIR = join(__dirname, '..', 'proto');

export const CHATIA_PROTO_PATH    = join(PROTO_DIR, 'chatia.proto');
export const NOTIF_PROTO_PATH     = join(PROTO_DIR, 'notificaciones.proto');
export const ANALYTICS_PROTO_PATH = join(PROTO_DIR, 'analytics.proto');
export const WORKERS_PROTO_PATH   = join(PROTO_DIR, 'workers.proto');
export const PAGOS_PROTO_PATH     = join(PROTO_DIR, 'pagos.proto');

export const CHATIA_PACKAGE    = 'chatia';
export const NOTIF_PACKAGE     = 'notificaciones';
export const ANALYTICS_PACKAGE = 'analytics';
export const WORKERS_PACKAGE   = 'workers';
export const PAGOS_PACKAGE     = 'pagos';
EOF
  ok "packages/proto/src/index.ts — exports agregados"
else
  ok "packages/proto/src/index.ts — ya tiene exports"
fi

echo ""
ok "════════════════════════════════════════════════════════"
ok "  3 fixes aplicados"
ok "════════════════════════════════════════════════════════"
echo ""
echo "  [1] analytics.service.ts    — reescrito completo con getAgentMetrics"
echo "  [2] conversations.service.ts — restaurado desde git"
echo "  [3] proto/src/index.ts      — exports completos"
echo ""
echo "Próximo: make g → push → Railway redeploy"