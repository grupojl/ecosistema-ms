# Tasks — Cómo escalar a cada fase

Checklist ejecutable. Cada task tiene: qué hacer, dónde está el código relevante,
y cómo saber que está hecho. En orden de ejecución dentro de cada fase.

---

## FASE 1 — Desarrollo (Escalones 1, 2, 4)

### Escalón 1 — Código

- [ ] **[E1-01]** Crear `ZodValidationPipe` en `src/common/pipes/` de cada servicio
  → Ver patrón en `.claude/checklists/backend-capa-2-rest-controllers.md`
  → Done cuando: `pnpm build` pasa sin `class-validator` en ningún import

- [ ] **[E1-02]** Migrar los ~20 DTOs de `chatia-backend` a Zod inline
  → Carpetas: `agents/`, `contacts/`, `conversations/`, `faq/`, `messages/`, `projects/`, `webhooks/`, `ecosystem/`, `assistant/`, `ai-config/`, `internal/`, `modules/`
  → Done cuando: `grep -r "class-validator" chatia-backend/src` → 0 resultados

- [ ] **[E1-03]** Migrar DTOs de `pasarelapagos-backend` a Zod inline
  → Carpetas: `modules/payments/dto/`, `modules/tenants/`
  → Done cuando: `grep -r "class-validator" pasarelapagos-backend/src` → 0 resultados

- [ ] **[E1-04]** Migrar DTOs de `workers-backend` a Zod inline
  → Carpetas: `campaigns/dto/`, `jobs/dto/`
  → Done cuando: `grep -r "class-validator" workers-backend/src` → 0 resultados

- [ ] **[E1-05]** Eliminar `class-validator` y `class-transformer` de todos los `package.json`
  → Done cuando: `grep -r "class-validator" */package.json` → 0 resultados

- [ ] **[E1-06]** Crear MOLDE VIVO: migrar `chatia-backend/conversations/` a Domain + Repository
  → Crear: `domain/conversation.entity.ts`, `domain/conversation.errors.ts`
  → Crear: `repository/conversations.repository.interface.ts`, `repository/prisma-conversations.repository.ts` con `toEntity()`
  → Done cuando: `conversations.service.ts` no importa `PrismaService`

- [ ] **[E1-07]** Migrar `pasarelapagos-backend/modules/payments/` a Domain + Repository
  → Done cuando: `payments.service.ts` no importa `PrismaService`

- [ ] **[E1-08]** Migrar `chatia-backend/contacts/` a Domain + Repository (usar MOLDE VIVO)
- [ ] **[E1-09]** Migrar `chatia-backend/projects/` a Domain + Repository
- [ ] **[E1-10]** Migrar `chatia-backend/agents/` a Domain + Repository
- [ ] **[E1-11]** Migrar `workers-backend/campaigns/` a Domain + Repository
- [ ] **[E1-12]** Migrar `notificaciones-backend/notifications/` a Domain + Repository

- [ ] **[E1-13]** Auditar todos los queries Prisma sin `ecosystemId` en el `where`
  → Comando: `grep -rn "findMany\|findFirst\|findUnique" */src --include="*.ts" | grep -v "ecosystemId"`
  → Done cuando: cero queries de negocio sin scope de tenant

- [ ] **[E1-14]** Auditar y eliminar `as any` y `as unknown as` fuera de `// @ecosistema-ms/jsonb-cast`
  → Done cuando: `grep -rn "as any\|as unknown as" */src --include="*.ts"` → solo líneas con el comentario

### Escalón 2 — Configuración

- [ ] **[E2-01]** Verificar que no hay secretos en el repo
  → Comando: `git grep -r "PRIVATE_KEY\|-----BEGIN" --include="*.ts" --include="*.json"`
  → Done cuando: 0 resultados con valores reales

- [ ] **[E2-02]** Crear `.env.example` en cada servicio con todas las variables requeridas
  → Incluir: `DATABASE_URL`, `REDIS_URL`, `FIREBASE_*`, `*_GRPC_URL`, `ALLOWED_ORIGINS`
  → Done cuando: los 5 servicios tienen `.env.example` completo

- [ ] **[E2-03]** Agregar validación de env vars al arranque en cada `main.ts`
  → Done cuando: el servicio falla con mensaje claro si falta una var obligatoria

### Escalón 4 — Base de Datos

- [ ] **[E4-01]** Verificar índices compuestos `@@index([ecosystemId, organizationId])` en cada schema
  → Done cuando: todos los modelos con tenant scope tienen el índice

- [ ] **[E4-02]** Confirmar que `prisma migrate deploy` corre antes del `CMD` en cada Dockerfile
  → Done cuando: los 5 Dockerfiles tienen el migrate antes del start

- [ ] **[E4-03]** Documentar política de backups de Railway y RPO resultante
  → Done cuando: `roadmap/deuda-tecnica.md` tiene la política documentada

- [ ] **[E4-04]** Documentar límites de pool de conexiones por servicio
  → Done cuando: cada servicio tiene el límite de conexiones documentado en su `services/<servicio>.md`

---

## FASE 2 — Estabilización (Escalones 3, 5, 6)

### Escalón 3 — Infraestructura

- [ ] **[E3-01]** Confirmar HTTPS en todos los endpoints públicos de Railway
- [ ] **[E3-02]** Confirmar que puertos gRPC (5001-5005) no son accesibles desde internet
- [ ] **[E3-03]** Agregar `Helmet` en el `main.ts` de cada servicio
- [ ] **[E3-04]** Configurar `ALLOWED_ORIGINS` explícito sin wildcard en los 5 servicios
- [ ] **[E3-05]** Implementar rate limiting en endpoints públicos de chatia y pagos
  → Librería: `@nestjs/throttler`
  → Done cuando: endpoint público rechaza con 429 al superar el límite

### Escalón 5 — CI/CD

- [ ] **[E5-01]** Crear `.github/workflows/chatia-backend.yml` con typecheck + build
- [ ] **[E5-02]** Crear `.github/workflows/pasarelapagos-backend.yml`
- [ ] **[E5-03]** Crear `.github/workflows/notificaciones-backend.yml`
- [ ] **[E5-04]** Crear `.github/workflows/analytics-backend.yml`
- [ ] **[E5-05]** Crear `.github/workflows/workers-backend.yml`
- [ ] **[E5-06]** Configurar path filters para que cada workflow solo corra cuando cambia su servicio
- [ ] **[E5-07]** Agregar branch protection en GitHub: PR no mergeable si CI falla
- [ ] **[E5-08]** Documentar procedimiento de rollback en Railway
  → Done cuando: cualquier miembro del equipo puede hacer rollback en < 5 minutos

### Escalón 6 — Observabilidad

- [ ] **[E6-01]** Estandarizar logging JSON con campos: `service`, `ecosystemId`, `organizationId`, `correlationId`, `level`, `message`, `timestamp`
- [ ] **[E6-02]** Implementar propagación de `correlationId` en requests HTTP y gRPC
- [ ] **[E6-03]** Agregar `prom-client` en `chatia-backend` y `pasarelapagos-backend`
- [ ] **[E6-04]** Estandarizar métricas: `http_requests_total`, `grpc_requests_total`, `prisma_query_duration_seconds`
- [ ] **[E6-05]** Mejorar health check: verificar Redis + conexión gRPC a dependencias
- [ ] **[E6-06]** Configurar alertas en Railway cuando `/health` falla
- [ ] **[E6-07]** Crear dashboard básico (Railway metrics o Grafana) con estado de los 5 servicios

---

## FASE 3 — Hardening (Escalones 7, 8, 10)

### Escalón 7 — Seguridad

- [ ] **[E7-01]** Agregar `pnpm audit` en todos los workflows de GitHub Actions
- [ ] **[E7-02]** Configurar Snyk o Dependabot para alertas de vulnerabilidades
- [ ] **[E7-03]** Implementar rate limiting por `ecosystemId` (no solo por IP)
- [ ] **[E7-04]** Auditar usos de `$queryRaw` en Prisma — verificar que no hay interpolación sin sanitizar
- [ ] **[E7-05]** Agregar logs de seguridad con campo `securityEvent: true`
- [ ] **[E7-06]** Escribir runbook de respuesta a incidente de seguridad

### Escalón 8 — Privacidad

- [ ] **[E8-01]** Auditar cobertura del `PiiService` en pasarelapagos-backend — ningún dato PII sin cifrar
- [ ] **[E8-02]** Definir y documentar política de retención de datos por tipo
- [ ] **[E8-03]** Verificar soft-delete en todos los modelos con datos de usuario
- [ ] **[E8-04]** Implementar o documentar proceso de eliminación de datos a pedido
- [ ] **[E8-05]** Escribir test de cross-tenant: request de welver no retorna datos de manzana

### Escalón 10 — Async

- [ ] **[E10-01]** Documentar retry policy (attempts + backoff) de cada queue BullMQ
- [ ] **[E10-02]** Migrar `CircuitBreakerService` de memoria a Redis
- [ ] **[E10-03]** Agregar `ecosystemId` como prefijo en todas las claves de caché de Redis
- [ ] **[E10-04]** Instalar y configurar Bull Board para monitoreo de queues
- [ ] **[E10-05]** Definir y configurar límites de concurrencia por queue
- [ ] **[E10-06]** Confirmar Redis con persistencia AOF activa

---

## FASE 4 — Escala (Escalones 9, 11, 12, 13)

### Escalón 9 — Disaster Recovery

- [ ] **[E9-01]** Definir RTO y RPO por servicio — documentar en este archivo
- [ ] **[E9-02]** Probar restauración de backup de DB en staging
- [ ] **[E9-03]** Escribir runbook de recuperación para los 3 escenarios más probables
- [ ] **[E9-04]** Ejecutar drill de recuperación y documentar resultados

### Escalón 11 — Rendimiento

- [ ] **[E11-01]** Medir latencias actuales: `p50`, `p95`, `p99` por endpoint
- [ ] **[E11-02]** Agregar paginación a todos los endpoints de listado sin ella
- [ ] **[E11-03]** Identificar y optimizar queries lentas con `EXPLAIN ANALYZE`
- [ ] **[E11-04]** Evaluar gRPC streaming para mensajes de chat en tiempo real

### Escalón 12 — Alta Disponibilidad

- [ ] **[E12-01]** Configurar 2+ réplicas de chatia-backend y pasarelapagos-backend en Railway
- [ ] **[E12-02]** Implementar health check con 3 estados: ok / degraded / down
- [ ] **[E12-03]** Ejecutar chaos drill: apagar analytics-backend y verificar que chatia sigue funcionando
- [ ] **[E12-04]** Ejecutar chaos drill: saturar queue de workers y verificar comportamiento
- [ ] **[E12-05]** Documentar resultados de cada chaos drill

### Escalón 13 — FinOps

- [ ] **[E13-01]** Configurar dashboard de costos por servicio en Railway
- [ ] **[E13-02]** Configurar escalado automático en Railway para servicios con carga variable
- [ ] **[E13-03]** Calcular y documentar costo estimado por ecosistema mensualmente
- [ ] **[E13-04]** Documentar costo marginal de incorporar un nuevo ecosistema
- [ ] **[E13-05]** Revisar y documentar TTL de caché Redis como balance costo/frescura

---

## Resumen de progreso

| Fase | Tasks totales | Completadas | % |
|------|--------------|-------------|---|
| Fase 1 — Desarrollo | 18 | 0 | 0% |
| Fase 2 — Estabilización | 16 | 0 | 0% |
| Fase 3 — Hardening | 15 | 0 | 0% |
| Fase 4 — Escala | 14 | 0 | 0% |
| **Total** | **63** | **0** | **0%** |

Actualizar este resumen en cada sprint.
