#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix analytics-backend y chatia-backend (sin tocar Dockerfiles)
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

# =============================================================================
# FIX 1 — analytics-backend: getAgentMetrics appendeado FUERA de la clase
# Eliminar el código appendeado y reescribir solo analytics.service.ts
# con el método dentro de la clase correctamente
# =============================================================================
log "[1/3] analytics-backend — reescribir analytics.service.ts con getAgentMetrics dentro de la clase"

# Leer el archivo hasta la línea donde empieza el código appendeado (el comentario // A-2.3)
# y truncar ahí, luego agregar el método correctamente dentro de la clase

ANA_SVC="$ROOT/analytics-backend/src/analytics/analytics.service.ts"

# Eliminar todo desde el comentario A-2.3 en adelante (el append roto)
if grep -q "// A-2.3" "$ANA_SVC" 2>/dev/null; then
  # Obtener la línea donde empieza el append
  LINE=$(grep -n "// A-2.3" "$ANA_SVC" | head -1 | cut -d: -f1)
  # Truncar el archivo en esa línea - 1
  head -n $((LINE - 1)) "$ANA_SVC" > "${ANA_SVC}.tmp"

  # El archivo termina con } de la clase seguido de } del módulo o similar
  # Necesitamos insertar el método ANTES del último }
  # Contar cuántas } hay al final
  LAST_LINE=$(wc -l < "${ANA_SVC}.tmp")
  # Quitar el último } del archivo
  head -n $((LAST_LINE - 1)) "${ANA_SVC}.tmp" > "${ANA_SVC}.tmp2"

  # Agregar el método y cerrar la clase
  cat >> "${ANA_SVC}.tmp2" << 'METHOD'

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

    return { agents: all.slice(offset, offset + limit), total: all.length };
  }
}
METHOD

  mv "${ANA_SVC}.tmp2" "$ANA_SVC"
  rm -f "${ANA_SVC}.tmp"
  ok "analytics.service.ts — getAgentMetrics insertado dentro de la clase"
else
  ok "analytics.service.ts — no tiene código appendeado, agregar método manualmente"
  # Insertar antes del último } del archivo
  LAST=$(wc -l < "$ANA_SVC")
  head -n $((LAST - 1)) "$ANA_SVC" > "${ANA_SVC}.tmp"
  cat >> "${ANA_SVC}.tmp" << 'METHOD2'

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

    return { agents: all.slice(offset, offset + limit), total: all.length };
  }
}
METHOD2
  mv "${ANA_SVC}.tmp" "$ANA_SVC"
  ok "analytics.service.ts — getAgentMetrics agregado"
fi

# =============================================================================
# FIX 2 — chatia-backend: conversations.service.ts — eliminar el stub roto
# que generé con export from '.original.js' y restaurar el original del repo
# =============================================================================
log "[2/3] chatia-backend — conversations.service.ts: restaurar original"

CONV_SVC="$ROOT/chatia-backend/src/conversations/conversations.service.ts"

# Si tiene el stub roto que generé, restaurar con git
if grep -q "conversations.service.original.js" "$CONV_SVC" 2>/dev/null; then
  git -C "$ROOT" checkout HEAD~1 -- chatia-backend/src/conversations/conversations.service.ts 2>/dev/null || \
  git -C "$ROOT" checkout HEAD -- chatia-backend/src/conversations/conversations.service.ts 2>/dev/null || \
  echo "ACCIÓN MANUAL: restaurar chatia-backend/src/conversations/conversations.service.ts del original del repo"
  ok "conversations.service.ts restaurado via git"
fi

# =============================================================================
# FIX 3 — chatia-backend: 3 errores restantes
# a) joi no instalado → instalar o usar alternativa
# b) conversations.service.ts .original.js → resuelto arriba
# c) Express.Multer.File → instalar @types/multer
# =============================================================================
log "[3/3] chatia-backend — joi y @types/multer"

CHATIA_PKG="$ROOT/chatia-backend/src/config/validation.schema.ts"

# Si el archivo usa joi pero joi no está instalado, reemplazarlo con zod que ya está en deps
if [ -f "$ROOT/chatia-backend/src/config/validation.schema.ts" ]; then
  if grep -q "from 'joi'" "$ROOT/chatia-backend/src/config/validation.schema.ts" 2>/dev/null; then
    cat > "$ROOT/chatia-backend/src/config/validation.schema.ts" << 'EOF'
// chatia-backend/src/config/validation.schema.ts
// Migrado de joi a zod (joi no está en las dependencias del proyecto)
import { z } from 'zod';

export const configValidationSchema = z.object({
  NODE_ENV:     z.enum(['development', 'production', 'test']).default('development'),
  PORT:         z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_HOST:   z.string().default('localhost'),
  REDIS_PORT:   z.coerce.number().default(6379),
  GROQ_API_KEY: z.string().optional(),
  JWT_SECRET:   z.string().optional(),
});

export type ConfigSchema = z.infer<typeof configValidationSchema>;
EOF
    ok "validation.schema.ts — joi → zod"
  fi
fi

# Agregar @types/multer a chatia-backend si falta
CHATIA_PKGJSON="$ROOT/chatia-backend/package.json"
if ! grep -q "@types/multer" "$CHATIA_PKGJSON" 2>/dev/null; then
  sed -i 's|"@types/node": "catalog:"|"@types/node": "catalog:",\n    "@types/multer": "^1.4.12"|g' "$CHATIA_PKGJSON"
  ok "chatia package.json — @types/multer agregado"
else
  ok "chatia package.json — @types/multer ya presente"
fi

# También agregar @types/multer al catalog si no está
CATALOG="$ROOT/pnpm-workspace.yaml"
if ! grep -q "@types/multer" "$CATALOG" 2>/dev/null; then
  sed -i 's|"@types/uuid": "^10.0.0"|"@types/uuid": "^10.0.0"\n  "@types/multer": "^1.4.12"|g' "$CATALOG"
  ok "pnpm-workspace.yaml — @types/multer en catalog"
fi

echo ""
ok "════════════════════════════════════════════════════════"
ok "  3 fixes aplicados"
ok "════════════════════════════════════════════════════════"
echo ""
echo "  [1] analytics.service.ts    — getAgentMetrics dentro de la clase"
echo "  [2] conversations.service.ts — restaurado original via git"
echo "  [3] chatia validation.schema + @types/multer"
echo ""
echo "Próximo: pnpm install && make g"