# Sprints — ecosistema-ms

**Última actualización:** 2026-09-02

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

```bash
pnpm -r build
```

Errores más probables si aparecen:
- Algún controller que llame a `getPreferences()` sin pasar `ecosystemId` (nuevo parámetro)
- Algún controller de `projects` que siga usando `CreateProjectDto` importado
- `OrgContext` — verificar que los guards de pasarelapagos ya lo poblan con `tenantId`

### Paso 2 — Tests baseline

Ver: `.claude/checklists/testing-desde-cero.md`

Orden sugerido:
1. Unit tests de domain entities (`payment.entity`, `conversation.entity`)
2. Integration tests de los repository adapters (Prisma)
3. E2E del contrato HTTP de cada servicio (Supertest)
4. Test de cross-tenant: request con ecosystemId A no retorna datos de ecosystemId B

### Paso 3 — DT-015 (cuando haya 2+ ecosistemas en prod)

```bash
pnpm --filter chatia-backend prisma migrate dev --name add-ecosystemId-conversation
```

### Paso 4 — Observabilidad

Ver: `.claude/checklists/observabilidad.md`
- OpenTelemetry traces activos
- Prometheus métricas expuestas en /metrics
- Grafana dashboards por servicio
