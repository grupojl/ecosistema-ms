#!/usr/bin/env bash
# =============================================================================
# x.sh — actualizar .claude/roadmap con cierre de FASE 5
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${CYAN}[x.sh]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
sep()  { echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

DRY=false
[[ "${1:-}" == "--dry-run" ]] && DRY=true
[[ -f "pnpm-workspace.yaml" ]] || { echo "Ejecutar desde la raíz del monorepo"; exit 1; }
$DRY && echo -e "${YELLOW}DRY-RUN${NC}\n"

write_file() {
  local path="$1"
  $DRY && { echo -e "${YELLOW}  DRY: $path${NC}"; cat > /dev/null; return; }
  mkdir -p "$(dirname "$path")"
  cat > "$path"
  ok "$path"
}

TODAY=$(date +%Y-%m-%d)

# =============================================================================
sep
log "${BOLD}1/3 — deuda-tecnica.md${NC}"
# =============================================================================

write_file ".claude/roadmap/deuda-tecnica.md" << EOF
# Deuda técnica — ecosistema-ms

**Última actualización:** ${TODAY}

## ✅ RESUELTOS — todo cerrado

| ID | Deuda | Cómo quedó |
|----|-------|------------|
| ~~DT-001~~ | dto/ huérfanas (17 carpetas) | Eliminadas |
| ~~DT-002~~ | class-validator inline (9 archivos) | Migrado a Zod — 0 imports residuales |
| ~~DT-003~~ | AllExceptionsFilter no registrado | Registrado en chatia + workers main.ts |
| ~~DT-004~~ | ConversationsService → PrismaService directo | Migrado a IConversationsRepository |
| ~~DT-005~~ | PaymentsService → PrismaService directo | PrismaService + IPaymentsRepository coexisten (ver nota) |
| ~~DT-006~~ | reconciliation.service sin tenantId en where | ConfigService + tenantId dentro del where |
| ~~DT-007~~ | contacts/ sin Domain/Repository | — (decidido: no aplicar, scope suficiente con organizationId) |
| ~~DT-008~~ | projects/ sin Domain/Repository | — (ídem, imports dto corregidos a schemas.ts) |
| ~~DT-009~~ | campaigns/ sin Domain/Repository | — (ídem) |
| ~~DT-011~~ | notifications.service getStats() sin ecosystemId | ecosystemId en StatsQuery + where |
| ~~DT-012~~ | analytics getConversationsByDay() sin ecosystemId | ecosystemId en firma + controller |
| ~~DT-013~~ | Timeouts gRPC no definidos | channelOptions/keepalive en 5 módulos grpc-client |
| ~~DT-014~~ | preferences.service getPreferences() sin ecosystemId | ecosystemId en where |
| ~~DT-016~~ | contacts.service import roto class-validator | Reescrito usando schemas.ts |
| ~~DT-017~~ | OrgContext sin tenantId | tenantId agregado a la interface |
| ~~DT-018~~ | projects.service imports dto legacy rotos | Migrado a schemas.ts (CreateProjectInput/UpdateProjectInput) |
| ~~DT-A~~ | Sin ZodValidationPipe ni filtros de excepción | Resuelto |
| ~~DT-B~~ | Controllers con class-validator | Resuelto |
| ~~DT-C~~ | class-validator en package.json | Resuelto |
| ~~DT-D~~ | conversations/ sin domain+repository | Resuelto |
| ~~DT-E~~ | payments/ sin domain+repository | Resuelto |
| ~~DT-F~~ | Sin contratos gRPC documentados | Resuelto |
| ~~DT-G~~ | Sin auditoría multi-tenant | Resuelto |

### Nota de arquitectura — DT-005

\`PaymentsService\` inyecta tanto \`PrismaService\` como \`IPaymentsRepository\`:
- \`IPaymentsRepository\` → lecturas simples: \`findById\`, \`findByIdempotencyKey\`, \`list\`
- \`PrismaService\` directamente → operaciones que requieren \`\$transaction\` multi-tabla

---

## 🟡 PENDIENTE — decisión de arquitectura (no urgente)

| ID | Deuda | Archivo | Acción |
|----|-------|---------|--------|
| DT-015 | Modelo \`Conversation\` sin \`ecosystemId\` directo en schema | \`chatia-backend/prisma/schema.prisma\` | Evaluar migración antes de múltiples ecosistemas en prod |
| DT-010 | CircuitBreakerService en memoria | chatia + pasarelapagos | Migrar a Redis cuando se escale a múltiples instancias |

### DT-015 — cuándo hacerlo

El modelo \`Conversation\` llega a \`ecosystemId\` via join \`Contact → Organization\`.
Funciona correctamente con un ecosistema. Antes de tener 2+ ecosistemas con datos
reales en la misma DB, agregar:

\`\`\`prisma
model Conversation {
  ecosystemId    String
  organizationId String
  @@index([ecosystemId, organizationId])
}
\`\`\`

Luego: \`pnpm --filter chatia-backend prisma migrate dev --name add-ecosystemId-conversation\`
EOF

# =============================================================================
sep
log "${BOLD}2/3 — sprints.md${NC}"
# =============================================================================

write_file ".claude/roadmap/sprints.md" << EOF
# Sprints — ecosistema-ms

**Última actualización:** ${TODAY}

## Estado de fases

| Fase | Descripción | Estado |
|------|-------------|--------|
| FASE 0 | Estructura base .claude/ | ✅ COMPLETO |
| FASE 1 | Carpetas bloqueantes/dinámicas | ✅ COMPLETO |
| FASE 2 | ADR-001: DTOs → Zod | ✅ COMPLETO — 0 class-validator residuales |
| FASE 3 | Contratos gRPC documentados | ✅ COMPLETO |
| FASE 4 | Domain/Repository MOLDE VIVO | ✅ COMPLETO |
| FASE 5 | Multi-tenant — auditoría queries | ✅ COMPLETO |
| FASE 6 | Build limpio + tests baseline | 🔴 PRÓXIMA |

---

## Logros totales

- ✅ 0 imports de class-validator residuales
- ✅ 0 carpetas dto/ huérfanas
- ✅ 0 imports de DTOs legacy rotos
- ✅ AllExceptionsFilter en todos los main.ts
- ✅ ConversationsService + PaymentsService migrados a Domain/Repository
- ✅ DT-006: tenantId en reconciliation (bug de seguridad cerrado)
- ✅ ecosystemId en analytics, notificaciones y preferences
- ✅ Timeouts gRPC en los 5 módulos cliente
- ✅ ZodValidationPipe en todos los controllers
- ✅ OrgContext con tenantId
- ✅ projects.service + contacts.service usando schemas.ts

---

## PRÓXIMA SESIÓN — FASE 6

### Paso 1 — Build limpio (prioridad máxima)

\`\`\`bash
pnpm -r build
\`\`\`

Errores más probables si aparecen:
- Algún controller que llame a \`getPreferences()\` sin pasar \`ecosystemId\` (nuevo parámetro)
- Algún controller de \`projects\` que siga usando \`CreateProjectDto\` importado
- \`OrgContext\` — verificar que los guards de pasarelapagos ya lo poblan con \`tenantId\`

### Paso 2 — Tests baseline

Ver: \`.claude/checklists/testing-desde-cero.md\`

Orden sugerido:
1. Unit tests de domain entities (\`payment.entity\`, \`conversation.entity\`)
2. Integration tests de los repository adapters (Prisma)
3. E2E del contrato HTTP de cada servicio (Supertest)
4. Test de cross-tenant: request con ecosystemId A no retorna datos de ecosystemId B

### Paso 3 — DT-015 (cuando haya 2+ ecosistemas en prod)

\`\`\`bash
pnpm --filter chatia-backend prisma migrate dev --name add-ecosystemId-conversation
\`\`\`

### Paso 4 — Observabilidad

Ver: \`.claude/checklists/observabilidad.md\`
- OpenTelemetry traces activos
- Prometheus métricas expuestas en /metrics
- Grafana dashboards por servicio
EOF

# =============================================================================
sep
log "${BOLD}3/3 — auditoria-multitenant.md${NC}"
# =============================================================================

write_file ".claude/roadmap/auditoria-multitenant.md" << EOF
# Auditoría multi-tenant — queries sin ecosystemId

**Última actualización:** ${TODAY}
**Estado: FASE 5 COMPLETA ✅**

## Contexto

En ecosistema-ms el scope de tenant es DOBLE:
- \`ecosystemId\` — identifica al cliente de la plataforma
- \`organizationId\` — identifica la organización dentro del ecosistema

Todo query Prisma de negocio debe llevar AMBOS filtros.

---

## Estado final por servicio

### chatia-backend ✅

| Archivo | Método | ecosystemId | organizationId | Estado |
|---------|--------|-------------|----------------|--------|
| \`conversations.service.ts\` | todos | ⚠️ Via Contact→Org | ✅ | DT-015 pendiente (no urgente) |
| \`contacts.service.ts\` | todos | — (Contact no tiene ecosystemId propio) | ✅ | ✅ Aceptable |
| \`projects.service.ts\` | todos | — (Project no tiene ecosystemId propio) | ✅ | ✅ Aceptable |
| \`messages.service.ts\` | todos | — (scope via channelAccount) | ✅ | ✅ Aceptable |
| \`assignment.service.ts\` | todos | — (agentes son por org) | ✅ | ✅ Aceptable |
| \`assistant-config.service.ts\` | todos | — (config es por org) | ✅ | ✅ Aceptable |
| \`assistant-session.service.ts\` | todos | — (sesión es por org) | ✅ | ✅ Aceptable |

### pasarelapagos-backend ✅

| Archivo | Método | ecosystemId (tenantId) | organizationId | Estado |
|---------|--------|------------------------|----------------|--------|
| \`payments.service.ts\` | \`create()\` | ✅ tenantId en DB | ✅ | ✅ |
| \`payments.service.ts\` | \`findAll()\` | ✅ via ctx.tenantId | ✅ | ✅ |
| \`payments.service.ts\` | \`findOne()\` | ✅ via paymentsRepo | ✅ | ✅ |
| \`reconciliation.service.ts\` | \`schedulePendingReconciliation()\` | ✅ tenantId en where | — | ✅ DT-006 |

### notificaciones-backend ✅

| Archivo | Método | ecosystemId | organizationId | Estado |
|---------|--------|-------------|----------------|--------|
| \`notifications.service.ts\` | \`enqueue()\` | ✅ en DTO | ✅ | ✅ |
| \`notifications.service.ts\` | \`getStats()\` | ✅ en where | ✅ | ✅ DT-011 |
| \`preferences.service.ts\` | \`getPreferences()\` | ✅ en where | ✅ | ✅ DT-014 |
| \`preferences.service.ts\` | \`upsertPreference()\` | ✅ en create | ✅ | ✅ |

### analytics-backend ✅

| Archivo | Método | ecosystemId | organizationId | Estado |
|---------|--------|-------------|----------------|--------|
| \`analytics.service.ts\` | \`getOverview()\` | ✅ | ✅ | ✅ |
| \`analytics.service.ts\` | \`getAgentMetrics()\` | ✅ | ✅ | ✅ |
| \`analytics.service.ts\` | \`getConversationsByDay()\` | ✅ | ✅ | ✅ DT-012 |
| \`projections.service.ts\` | \`recalculateForOrg()\` | ✅ | ✅ | ✅ |

---

## Único pendiente no urgente — DT-015

El modelo \`Conversation\` no tiene \`ecosystemId\` directo en Prisma.
Llega via join \`Contact → Organization → ecosystemId\`.
Funciona con un ecosistema. Requiere migración antes de escalar a múltiples.

## Comando de auditoría rápida

\`\`\`bash
grep -rn "findMany\\|findFirst\\|findUnique" */src --include="*.ts" \\
  | grep -v "ecosystemId\\|tenantId\\|organizationId" \\
  | grep -v "node_modules\\|.spec.ts\\|repository.interface\\|health\\|prisma.service"
\`\`\`

## Test de cross-tenant (FASE 6)

\`\`\`ts
it('no retorna datos de otro ecosistema', async () => {
  // Crear datos con ecosystemId = 'welver'
  // Request con ecosystemId = 'manzana'
  // Resultado debe ser vacío o 403
});
\`\`\`
EOF

# =============================================================================
sep
log "Verificación..."
echo ""

for F in \
  ".claude/roadmap/deuda-tecnica.md" \
  ".claude/roadmap/sprints.md" \
  ".claude/roadmap/auditoria-multitenant.md"; do
  if $DRY; then
    echo -e "${YELLOW}  DRY: $F${NC}"
  elif [[ -f "$F" ]]; then
    LINES=$(wc -l < "$F")
    ok "$F ($LINES líneas)"
  fi
done

sep
echo ""
log "${GREEN}${BOLD}.claude/roadmap al día — FASE 5 documentada.${NC}"
echo ""
echo "  Mañana empezar por:"
echo "  pnpm -r build"
echo ""