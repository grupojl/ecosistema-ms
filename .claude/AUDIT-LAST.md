# AUDIT-LAST — ecosistema-ms

**Fecha:** 2026-09-12
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

---

## Actualización 2026-09-16 — Docker/Deploy: 10/10 ✅

**Auditor:** Claude (lectura directa de ecosistema-ms.xml post-fix)

### Dimensión Docker/Deploy — antes vs ahora

| Check | Antes | Ahora |
|---|---|---|
| `--platform=linux/amd64` | ❌ ausente | ✅ en los 3 `FROM` de cada Dockerfile |
| `dumb-init` | ✅ | ✅ |
| `entrypoint.sh` referenciado | ✅ | ✅ |
| `prisma migrate deploy` en entrypoint | ❌ ausente | ✅ |
| `exec node dist/main.js` | ❌ `node` directo | ✅ con `exec` |
| HEALTHCHECK con puerto hardcodeado | ✅ | ✅ |
| CMD → dumb-init | ✅ | ✅ |

### Score Docker/Deploy actualizado

| Dimensión | Score anterior | Score actual |
|---|---|---|
| Docker/Deploy | 8.5 | **10/10** |

### Archivos auditados

- `chatia-backend/Dockerfile` + `entrypoint.sh` → ✅ 10/10
- `pasarelapagos-backend/Dockerfile` + `entrypoint.sh` → ✅ 10/10
- `analytics-backend/Dockerfile` + `entrypoint.sh` → ✅ 10/10
- `notificaciones-backend/Dockerfile` + `entrypoint.sh` → ✅ 10/10
- `workers-backend/Dockerfile` + `entrypoint.sh` → ✅ 10/10

### Referencia

Ver scripts aplicados: `fix10-ecosistema-ms.sh`
Ver arquitectura declarada: `.claude/architecture/05-dockerfile-backend.md`

---

