#!/usr/bin/env bash
# =============================================================================
# x.sh — ecosistema-ms · Actualizar .claude/ con puntaje real auditado
#
# Uso: bash x.sh   (desde la raíz del monorepo)
#
# Solo escribe en .claude/ — no toca código de producción.
# Deja el puntaje 7.6/10 documentado con la brecha vs lo proyectado.
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()      { echo -e "${GREEN}  ✓${NC} $1"; }
warn()    { echo -e "${YELLOW}  !${NC} $1"; }
section() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n${CYAN}  $1${NC}\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

[[ -f "pnpm-workspace.yaml" ]] || { echo "Ejecutar desde la raíz del monorepo."; exit 1; }

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATE=$(date -u +"%Y-%m-%d")

mkdir -p .claude/roadmap .claude/decisions .claude/lifecycle

# =============================================================================
# 1. AUDIT-LAST.md — snapshot del estado real auditado hoy
# =============================================================================
section "1 — Escribiendo AUDIT-LAST.md"

cat > .claude/AUDIT-LAST.md << EOF
# AUDIT-LAST — ecosistema-ms

**Fecha:** $DATE
**Auditor:** Claude (lectura directa del código fuente en ecosistema-ms.xml)
**Puntaje real:** 7.6 / 10
**Puntaje proyectado (sesiones anteriores):** 8.3 — 9.1 / 10
**Desincronización:** +0.7 a +1.5 puntos sobre lo real

---

## Puntaje por dimensión (sin tests, observabilidad ni deploy)

| Dimensión            | Proyectado | **Real** | Δ     | Evidencia en código |
|----------------------|------------|----------|-------|---------------------|
| Arquitectura/Capas   | 9.0        | **7.5**  | -1.5  | AssignmentService, EcosystemService, KbDocumentService, AuditService todos con PrismaService directo. ConversationsService viola IConversationsRepository en handleIncomingMessage (this.prisma.channelAccount.findUnique directo) |
| Contratos/Tipado     | 8.5        | **7.5**  | -1.0  | ZodExceptionFilter existe en auth-server y main.ts de chatia+pagos. Notificaciones, analytics, workers sin ZodFilter — ZodError sale como 500 en esos 3 servicios |
| Multi-tenancy        | 9.0        | **9.0**  | =     | FASE 5 real. Todas las queries críticas con ecosystemId + organizationId. El único gap (DT-015 Conversation via join) es conocido y documentado |
| Comunicación gRPC    | 7.5        | **7.5**  | =     | Protos correctos. keepalive options en chatia y pagos. Workers usa CB propio sobre Redis (distinto de opossum estándar — inconsistencia menor) |
| Calidad de código    | 9.0        | **7.0**  | -2.0  | status as any en campaigns.service.ts, casts Prisma.AuditLogCreateInput/WhereInput (schema no generado aún), EmbeddingService es stub usando Groq chat en vez de modelo de embeddings real, FaqIngestProcessor es TODO explícito |
| Base de datos        | 9.0        | **6.5**  | -2.5  | getAgentMetrics con take: 50_000 × 2 sigue intacto — x.sh no llegó a analytics-backend. Índices compuestos no aplicados. Health controller de pasarela retorna { status: ok } hardcodeado sin SELECT 1 |
| Seguridad/RBAC       | 7.5        | **7.5**  | =     | Guards en auth-server correctos. RBAC documentado. Helmet pendiente de verificar en todos |
| Config/Twelve-Factor | 9.5        | **8.5**  | -1.0  | CacheService con degradación elegante (REDIS_ENABLED=false). Pino en chatia+pagos. App.module.ts de los 5 servicios sin LoggerModule+PrometheusModule importados |
| Documentación .claude| 9.5        | **9.5**  | =     | ADR-001..009, checklists, reglas duras, lifecycle, patches. El punto más sólido del sistema |
| **PROMEDIO**         | **9.1**    | **7.6**  | **-1.5** | |

---

## Causa raíz de la desincronización

### Causa 1 — x.sh corrió sobre 2 de 5 servicios
El último x.sh corrió desde un directorio que no tenía notificaciones-backend,
analytics-backend ni workers-backend. El 60% del sistema quedó sin:
- ZodExceptionFilter en main.ts
- LoggerModule + PrometheusModule en app.module.ts
- jest.config.ts con coverageThreshold
- RequestIdMiddleware registrado

### Causa 2 — Domain/Repository más superficial de lo que parecía
El ADR-002 dice "PENDIENTE DE IMPLEMENTAR". El código lo confirma:
Solo conversations/ y payments/ tienen repository interface.
El resto (assignment, ecosystem, kb-document, audit, campaigns) usa PrismaService directo.
ConversationsService viola su propio contrato en handleIncomingMessage.

### Causa 3 — Base de datos no mejoró
getAgentMetrics con take: 50_000 sigue igual desde septiembre.
analytics-backend no estaba en el checkout cuando corrió el x.sh de ADR-009.

---

## Tareas concretas para llegar al 9.0 real

| Prioridad | Tarea | Impacto |
|-----------|-------|---------|
| P0 | Correr x.sh (ADR-009) con los 5 servicios presentes | +0.5 Contratos, +1.0 Config |
| P0 | Aplicar parche DT-023 en analytics-backend manualmente | +2.5 Base de datos |
| P1 | Refactorizar handleIncomingMessage para usar solo IConversationsRepository | +0.5 Arquitectura |
| P1 | Health controller pasarela: agregar SELECT 1 a la DB | +0.3 Base de datos |
| P2 | EmbeddingService: migrar a modelo real (Sprint 4 pendiente) | +0.5 Calidad |
| P2 | Eliminar status as any en campaigns — usar enum cast tipado | +0.2 Calidad |

---

## Lo que NO está desincronizado (correcto en código Y en proyección)

- Multi-tenancy: 9.0 real — auditoria FASE 5 fue real
- Documentación .claude: 9.5 — ADRs, reglas duras, lifecycle son sólidos
- gRPC contratos: protos correctos, keepalive en los servicios que corrió el x.sh
- BullMQ + idempotencia: ADR-003 implementado correctamente
- Circuit breakers: opossum en chatia+pagos+notificaciones, CB Redis propio en workers
- Lock distribuido: SET NX EX correcto en analytics y workers (ADR-006)
EOF
ok "AUDIT-LAST.md escrito (puntaje 7.6)"

# =============================================================================
# 2. CLAUDE.md — resumen ejecutivo actualizado
# =============================================================================
section "2 — Actualizando CLAUDE.md"

cat > .claude/CLAUDE.md << EOF
# ecosistema-ms — Contexto para Claude

**Fecha de última auditoría:** $DATE
**Puntaje real (código auditado):** 7.6 / 10
**Puntaje proyectado (sesiones anteriores):** 8.3 — 9.1 ← DESINCRONIZADO

> El puntaje 8.3-9.1 de sesiones anteriores asumía que el x.sh corrió
> sobre los 5 servicios. En realidad corrió sobre 2 (chatia + pagos).
> El puntaje real auditado directamente en el código es 7.6.
> Ver .claude/AUDIT-LAST.md para el desglose completo.

---

## Stack

- NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- gRPC inter-servicio (@nestjs/microservices + @grpc/grpc-js)
- pnpm 10 workspaces con catalog único
- Deploy: Railway — 5 servicios separados, mismo repo

## Microservicios

| Servicio | HTTP | gRPC | Estado |
|----------|------|------|--------|
| chatia-backend | 3000 | 5001 | ZodFilter + pino ✅ |
| pasarelapagos-backend | 3001 | 5002 | ZodFilter + pino ✅ |
| notificaciones-backend | 3002 | 5003 | Sin ZodFilter ⚠️ |
| analytics-backend | 3003 | 5004 | Sin ZodFilter + DT-023 pendiente ⚠️ |
| workers-backend | 3004 | 5005 | Sin ZodFilter ⚠️ |

## Lo más sólido

- Multi-tenancy: ecosystemId + organizationId en todas las queries críticas
- Documentación .claude: ADR-001..009, checklists, reglas duras, lifecycle
- BullMQ: jobs idempotentes, DLQ en todos los servicios críticos
- Circuit breakers: opossum (chatia/pagos/notificaciones), Redis CB (workers)
- Lock distribuido: SET NX EX en analytics projections y workers campaigns

## Las brechas reales hoy

1. Domain/Repository: solo conversations y payments tienen el patrón completo
2. getAgentMetrics: take: 50_000 × 2 en Node — bomba de escala en analytics
3. 3 de 5 servicios sin ZodExceptionFilter (ZodError → HTTP 500)
4. app.module.ts de los 5 servicios sin LoggerModule ni PrometheusModule importados
5. Health controller de pasarela: sin SELECT 1 a la DB

## Próximas tareas (en orden de impacto)

1. Correr x.sh con los 5 servicios presentes en el checkout
2. Aplicar parche DT-023 (ver .claude/patches/DT-023-analytics-agent-metrics.md)
3. Refactorizar handleIncomingMessage en ConversationsService

## Regla antes de nueva sesión

Leer en orden: CLAUDE.md → AUDIT-LAST.md → decisions/ADR-009 → roadmap/deuda-tecnica.md
EOF
ok "CLAUDE.md actualizado"

# =============================================================================
# 3. deuda-tecnica.md — agregar brechas descubiertas en auditoría
# =============================================================================
section "3 — deuda-tecnica.md: brechas de auditoría"

if ! grep -q "DT-030" .claude/roadmap/deuda-tecnica.md 2>/dev/null; then
  cat >> .claude/roadmap/deuda-tecnica.md << EOF

---

## Auditoría $DATE — Brechas descubiertas (no estaban documentadas)

| ID | Deuda | Servicio | Severidad | Evidencia |
|----|-------|----------|-----------|-----------|
| DT-030 | ConversationsService.handleIncomingMessage usa this.prisma directo pese a IConversationsRepository inyectado | chatia | 🔴 | Viola ADR-002. Línea this.prisma.channelAccount.findUnique en el servicio |
| DT-031 | Health controller pasarela retorna status ok hardcodeado sin SELECT 1 | pasarela | 🔴 | Railway no detecta caída de DB. health.controller.ts línea 8519 |
| DT-032 | EmbeddingService genera embeddings via Groq chat prompt — no es un modelo de embeddings real | chatia | 🟡 | Sprint 4 pendiente. DIMENSIONS=384 es inventado |
| DT-033 | FaqIngestProcessor es stub explícito (TODO Sprint W-2) | workers | 🟡 | No procesa documentos reales. Solo loguea |
| DT-034 | status as any en campaigns.service.ts — enum cast sin tipo | workers | 🟡 | Línea 17070 — @ecosistema-ms/jsonb-cast comment ausente |
| DT-035 | app.module.ts de los 5 servicios sin LoggerModule ni PrometheusModule | todos | 🟡 | packages creados en ADR-008 pero nunca conectados |
| DT-036 | ZodExceptionFilter ausente en notificaciones, analytics y workers | 3 svcs | 🔴 | ZodError sale como HTTP 500 en esos servicios |
EOF
  ok "Brechas DT-030..036 registradas"
else
  warn "DT-030+ ya existen — sin cambios en deuda-tecnica.md"
fi

# =============================================================================
# 4. roadmap/sprints.md — registrar la auditoría
# =============================================================================
section "4 — Registrando auditoría en sprints.md"

cat >> .claude/roadmap/sprints.md << EOF

---

## Auditoría real de código — $TIMESTAMP

**Método:** lectura directa del código fuente (ecosistema-ms.xml)
**Resultado:** puntaje real 7.6/10 vs 8.3-9.1 proyectado en sesiones anteriores

### Desincronización detectada: +1.5 puntos sobre la realidad

La proyección de 8.3-9.1 asumía que el x.sh (ADR-009) corrió sobre los 5
servicios. En realidad solo corrió sobre chatia-backend y pasarelapagos-backend.
El resto del sistema no recibió los cambios.

### Puntaje auditado por dimensión

| Dimensión | Real |
|-----------|------|
| Arquitectura/Capas | 7.5 |
| Contratos/Tipado | 7.5 |
| Multi-tenancy | 9.0 |
| Comunicación gRPC | 7.5 |
| Calidad de código | 7.0 |
| Base de datos | 6.5 |
| Seguridad/RBAC | 7.5 |
| Config/Twelve-Factor | 8.5 |
| Documentación .claude | 9.5 |
| **Promedio** | **7.6** |

### Nuevas deudas documentadas: DT-030..036

### Para llegar al 9.0 real (no proyectado)

1. x.sh con los 5 servicios en el checkout → +0.7
2. Parche DT-023 analytics-backend manualmente → +0.8
3. Refactor handleIncomingMessage → IConversationsRepository → +0.3
4. Health controller pasarela con SELECT 1 → +0.2
EOF
ok "Sprint de auditoría registrado"

# =============================================================================
# 5. lifecycle/README.md — puntaje corriente visible al inicio de sesión
# =============================================================================
section "5 — lifecycle/README.md con puntaje visible"

cat > .claude/lifecycle/README.md << EOF
# Lifecycle — ecosistema-ms

## Puntaje actual (auditado $DATE)

**7.6 / 10** — código real leído directamente

| Dimensión | Puntaje |
|-----------|---------|
| Multi-tenancy | 9.0 ✅ |
| Documentación .claude | 9.5 ✅ |
| Config/Twelve-Factor | 8.5 🟡 |
| Arquitectura/Capas | 7.5 🟡 |
| Contratos/Tipado | 7.5 🟡 |
| Comunicación gRPC | 7.5 🟡 |
| Seguridad/RBAC | 7.5 🟡 |
| Calidad de código | 7.0 🟡 |
| Base de datos | 6.5 🔴 |

## Para llegar al 9.0 real

| Tarea | Impacto estimado |
|-------|-----------------|
| x.sh con los 5 servicios | +0.7 |
| Parche DT-023 (analytics-backend) | +0.8 |
| Refactor handleIncomingMessage | +0.3 |
| Health controller pasarela | +0.2 |

**Con esas 4 tareas: 9.6 proyectado**

## Fases

| Fase | Escalones | Estado |
|------|-----------|--------|
| Desarrollo (1,2,4) | Arquitectura, Config, DB | 🟡 7.8 promedio |
| Estabilización (3,5,6) | Infra, CI/CD, Obs | 🔴 Pendiente |
| Hardening (7,8,10) | SecOps, Privacidad, Async | ⚪ Futuro |
| Escala (9,11,12,13) | HA, Chaos, FinOps | ⚪ Futuro |
EOF
ok "lifecycle/README.md con puntaje visible"

# =============================================================================
# Resumen
# =============================================================================
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  .claude/ actualizado — puntaje real 7.6 / 10       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Archivos escritos:"
echo "    .claude/AUDIT-LAST.md          ← desglose completo con evidencia"
echo "    .claude/CLAUDE.md              ← resumen ejecutivo actualizado"
echo "    .claude/roadmap/deuda-tecnica.md  ← DT-030..036 agregadas"
echo "    .claude/roadmap/sprints.md     ← auditoría registrada"
echo "    .claude/lifecycle/README.md    ← puntaje visible al inicio de sesión"
echo ""
echo "  Puntaje anterior (proyectado): 8.3 — 9.1"
echo "  Puntaje real auditado:         7.6"
echo "  Desincronización:              +1.5 puntos sobre la realidad"
echo ""