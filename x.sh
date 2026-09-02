#!/usr/bin/env bash
# =============================================================================
# x-lifecycle.sh — Agrega .claude/lifecycle/ a ecosistema-ms
# Ejecutar desde la RAÍZ del monorepo: bash x-lifecycle.sh
# Es idempotente — sobreescribe si ya existe.
# =============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIFECYCLE_DIR="$ROOT_DIR/.claude/lifecycle"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ecosistema-ms — inicialización de .claude/lifecycle/       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "→ Destino: $LIFECYCLE_DIR"
echo ""

mkdir -p "$LIFECYCLE_DIR"

# =============================================================================
# README.md — índice del lifecycle
# =============================================================================
cat > "$LIFECYCLE_DIR/README.md" << 'EOF'
# Lifecycle — Software de Clase Mundial

Los 13 escalones que llevan ecosistema-ms al top 5-10% mundial.
Organizados en 4 fases de construcción — en orden de ejecución, no de importancia.

## Por qué este orden

El error que mata proyectos es implementar el escalón 9 antes de tener sólido
el escalón 1. Los escalones más altos son inútiles si los fundamentos fallan.
Netflix tiene Chaos Engineering porque primero tuvo arquitectura limpia.

## Las 4 fases

| Fase | Cuándo | Escalones | Estado |
|------|--------|-----------|--------|
| [Desarrollo](01-fase-desarrollo.md) | Ahora | 1, 2, 4 | 🔴 En curso |
| [Estabilización](02-fase-estabilizacion.md) | Antes de producción | 3, 5, 6 | ⚪ Pendiente |
| [Hardening](03-fase-hardening.md) | Primer ecosistema en prod | 7, 8, 10 | ⚪ Pendiente |
| [Escala](04-fase-escala.md) | 3 ecosistemas simultáneos | 9, 11, 12, 13 | ⚪ Pendiente |

## Los 13 escalones completos

| # | Escalón | Referente mundial | Fase |
|---|---------|-------------------|------|
| 1 | Código — Arquitectura y Calidad | Stripe · SQLite | Desarrollo |
| 2 | Configuración y Entorno | Twelve-Factor App · Heroku | Desarrollo |
| 3 | Infraestructura y Red | Cloudflare | Estabilización |
| 4 | Base de Datos y Almacenamiento | PlanetScale · Supabase | Desarrollo |
| 5 | CI/CD y Despliegues | Vercel · GitHub | Estabilización |
| 6 | Observabilidad y Operaciones | Datadog | Estabilización |
| 7 | Seguridad Defensiva (SecOps) | Snyk · CrowdStrike | Hardening |
| 8 | Cumplimiento Legal y Privacidad | Apple | Hardening |
| 9 | Recuperación ante Desastres | AWS | Escala |
| 10 | Datos Masivos y Async | Apache Kafka · Redis | Hardening |
| 11 | Rendimiento Percibido (UX) | Linear · Figma | Escala |
| 12 | Alta Disponibilidad y Chaos | Netflix | Escala |
| 13 | Eficiencia Financiera (FinOps) | Airbnb · Uber | Escala |

## Capa 0 — lo que sostiene los 13 escalones

Cultura de ingeniería documentada. ADRs, reglas duras, moldes vivos, checklists.
Sin esto, los 13 escalones colapsan cuando escala el equipo.
Es lo que estamos construyendo con `.claude/`.

## Posición objetivo

Con los 13 escalones sólidos + base documental:
**Top 5-10% mundial · Top 1% Latinoamérica**

El salto al top 1% mundial lo da el tiempo bajo carga real en producción,
no una decisión de arquitectura.
EOF
echo "✓ lifecycle/README.md"

# =============================================================================
# 01-fase-desarrollo.md — Escalones 1, 2, 4
# =============================================================================
cat > "$LIFECYCLE_DIR/01-fase-desarrollo.md" << 'EOF'
# Fase 1 — Desarrollo
## Escalones 1, 2, 4 — La base que hace cosmético todo lo demás

**Estado:** 🔴 En curso
**Cuándo:** Ahora, antes de cualquier otra fase
**Referentes:** Stripe (código) · Twelve-Factor App (config) · PlanetScale (DB)

---

## Escalón 1 — Código: Arquitectura y Calidad

### Qué significa para ecosistema-ms

Estructura limpia, TypeScript strict sin `any`, separación de capas,
validación defensiva en todos los límites del sistema.

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| TypeScript strict | ⚠️ Parcial | Activado pero con `as any` implícitos por falta de `toEntity()` |
| Separación de capas | ❌ No iniciado | Services con Prisma directo — sin Domain/Repository |
| Validación de entrada | ❌ BLOQUEANTE | `class-validator` DTOs en todos los servicios |
| Arquitectura gRPC | ✅ Implementado | Contratos `.proto` definidos, grpc-client disponible |
| Sin cross-service imports | ✅ Implementado | Monorepo respeta fronteras por Dockerfile |
| Multi-tenant scope | ⚠️ Parcial | `ecosystemId` + `organizationId` no consistente en todos los queries |

### Qué hay que hacer (en orden)

1. **Migrar DTOs a Zod** — `.claude/checklists/backend-capa-2-rest-controllers.md`
   `class-validator` es el síntoma. El problema de fondo es que la validación
   no produce tipos de dominio — Zod sí.

2. **Crear Domain/Repository con MOLDE VIVO** — `.claude/checklists/backend-capas-4-5-domain-repo.md`
   Empezar por `chatia-backend/conversations/`. Una vez migrado, es el molde
   que todos los demás módulos siguen.

3. **Eliminar `as any` y `as unknown as`** — agregar `toEntity()` privado en
   cada repository. Ver patrón en `.claude/decisions/ADR-002-domain-repo.md`.

4. **Scope consistente** — todo query Prisma lleva `ecosystemId` + `organizationId`.
   Ver `.claude/checklists/backend-capa-6-multitenant.md`.

### Cómo saber que este escalón está completo

- `tsc --noEmit` pasa sin errores en los 5 servicios
- Cero `class-validator` en ningún `package.json`
- Cero `as any` fuera de `// @ecosistema-ms/jsonb-cast`
- `conversations/` de chatia-backend tiene `domain/` + `repository/` con `toEntity()`
- `payments/` de pasarelapagos-backend tiene `domain/` + `repository/`
- Todo query Prisma tiene `ecosystemId` en el `where`

### Referente: por qué Stripe

La API de Stripe es el estándar de ergonomía y tipado. Cada método retorna
un tipo explícito, cada error está tipado, cada input está validado.
Si un ingeniero nuevo puede leer el código de un módulo y entender qué hace
sin preguntar — el escalón 1 está bien.

---

## Escalón 2 — Configuración y Entorno

### Qué significa para ecosistema-ms

Separación estricta de variables por entorno, credenciales fuera del código,
catalog único de dependencias, configuración declarativa por servicio.

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| Catalog único pnpm | ✅ Implementado | `catalog:` default — sin named catalogs |
| Variables por Dockerfile | ✅ Implementado | `ARG`/`ENV` declarados en cada Dockerfile |
| Sin `.env` compartido | ✅ Implementado | Cada servicio declara sus propias vars |
| URLs gRPC por env var | ✅ Implementado | `CHATIA_GRPC_URL`, `PAGOS_GRPC_URL`, etc. |
| Secretos fuera del código | ⚠️ Verificar | Firebase private key — confirmar que no está en repo |
| `.env.example` por servicio | ⚠️ Verificar | Documentar todas las vars requeridas |

### Qué hay que hacer

1. **Verificar que no hay secretos en el repo** — Firebase private key, API keys
   de MercadoPago/Stripe, Redis password — nunca en el código.

2. **Crear `.env.example` por servicio** con todas las variables requeridas
   y su descripción. Sin valores reales — solo la forma.

3. **Documentar vars de entorno gRPC** — confirmar que todos los servicios
   tienen las variables de los otros servicios correctamente nombradas.

4. **Validación de configuración al arranque** — cada `main.ts` debe fallar
   con un mensaje claro si falta una variable obligatoria. No arrancar con
   configuración incompleta.

```ts
// Patrón correcto — validar al arranque
const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL', 'FIREBASE_PROJECT_ID'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}
```

### Cómo saber que este escalón está completo

- `git grep -r "PRIVATE_KEY\|SECRET\|PASSWORD" --include="*.ts"` → cero resultados con valores reales
- Cada servicio tiene `.env.example` completo
- El servicio falla en arranque con mensaje claro si falta una var

### Referente: Twelve-Factor App

La metodología que estandarizó la configuración moderna. Factor III:
"Store config in the environment". Sin valores en el código, sin
configuración que cambia entre entornos en el repo.

---

## Escalón 4 — Base de Datos y Almacenamiento

### Qué significa para ecosistema-ms

Migraciones versionadas y automáticas, pool de conexiones gestionado,
backups automáticos, schema como fuente de verdad.

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| Prisma ORM | ✅ Implementado | Schema declarativo en cada servicio |
| Migraciones versionadas | ✅ Implementado | `prisma/migrations/` en cada servicio |
| Pool de conexiones | ⚠️ Verificar | Prisma gestiona el pool — confirmar límites por servicio |
| Backups automáticos | ⚠️ Railway | Railway provisiona PostgreSQL — verificar política de backups |
| DB separada por servicio | ✅ Implementado | Cada microservicio tiene su `DATABASE_URL` propia |
| DB separada por ecosistema | ⚠️ Verificar | Confirmar que welver, manzana, mexus usan DBs distintas |
| Índices en campos de tenant | ⚠️ Parcial | `@@index([ecosystemId, organizationId])` — verificar cobertura |

### Qué hay que hacer

1. **Verificar índices compuestos** — todo modelo con `ecosystemId` +
   `organizationId` debe tener `@@index([ecosystemId, organizationId])` en
   el schema de Prisma. Sin índice = query lento a escala.

2. **Confirmar política de backups en Railway** — qué RPO tiene cada base de
   datos. Si Railway no garantiza el RPO que necesitamos, agregar backup
   externo (S3 o similar).

3. **Confirmar límites del pool de conexiones** — por defecto Prisma abre
   hasta N conexiones. Con 5 microservicios + múltiples réplicas, el límite
   de conexiones de PostgreSQL puede ser un cuello de botella.

4. **Migración en deploy automático** — confirmar que `prisma migrate deploy`
   corre antes del arranque del servicio en Railway, no después.

5. **Semilla de datos de ecosistemas** — confirmar que welver, manzana, mexus
   tienen sus registros base en las tablas correspondientes.

### Cómo saber que este escalón está completo

- Todo modelo con tenant scope tiene `@@index([ecosystemId, organizationId])`
- `prisma migrate deploy` corre en el Dockerfile antes del `CMD`
- Backups automáticos confirmados con RPO documentado
- Pool de conexiones documentado por servicio

### Referente: PlanetScale

Migraciones sin tiempo de inactividad, branching de schema, connection pooling
automático. El estándar que Railway intenta aproximar. El principio clave:
el schema nunca es una sorpresa — está versionado y la migración es atómica.
EOF
echo "✓ lifecycle/01-fase-desarrollo.md"

# =============================================================================
# 02-fase-estabilizacion.md — Escalones 3, 5, 6
# =============================================================================
cat > "$LIFECYCLE_DIR/02-fase-estabilizacion.md" << 'EOF'
# Fase 2 — Estabilización
## Escalones 3, 5, 6 — Antes de producción real

**Estado:** ⚪ Pendiente — iniciar cuando Fase 1 esté completa
**Cuándo:** Antes de que el primer ecosistema reciba tráfico real
**Referentes:** Cloudflare (infra) · Vercel/GitHub (CI/CD) · Datadog (observabilidad)

---

## Escalón 3 — Infraestructura y Red

### Qué significa para ecosistema-ms

Proxy inverso con HTTPS, aislamiento de contenedores por servicio,
firewall restringido a puertos esenciales, red privada para comunicación interna.

### Qué hay que hacer

1. **Confirmar HTTPS en todos los endpoints públicos** — Railway provisiona
   TLS automáticamente. Verificar que ningún servicio expone HTTP plano al exterior.

2. **Red privada Railway para gRPC** — los endpoints gRPC nunca deben ser
   públicos. Confirmar que `{servicio}.railway.internal:500X` solo es accesible
   desde la red privada de Railway.

3. **CORS estricto** — `ALLOWED_ORIGINS` explícito en cada servicio.
   Sin wildcard `*`. Cada servicio declara exactamente qué orígenes acepta.

4. **Rate limiting en endpoints públicos** — chatia-backend y pasarelapagos-backend
   exponen endpoints públicos. Agregar rate limiting por IP + por `ecosystemId`.

5. **Headers de seguridad** — `Helmet` en cada servicio NestJS:
   `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`.

6. **Firewall Railway** — confirmar que los puertos gRPC (5001-5005) no son
   accesibles desde internet, solo desde la red interna de Railway.

### Cómo saber que este escalón está completo

- `curl http://{servicio}.up.railway.app` → redirige a HTTPS o rechaza
- Los puertos gRPC no responden desde internet
- `ALLOWED_ORIGINS` configurado en los 5 servicios sin wildcard
- Helmet activo en todos los servicios
- Rate limiting activo en endpoints públicos

---

## Escalón 5 — CI/CD y Despliegues

### Qué significa para ecosistema-ms

Pipeline de tests automáticos en cada PR, imágenes Docker inmutables,
deploy automático en merge a main, rollback en menos de 2 minutos.

### Qué hay que hacer

1. **GitHub Actions por servicio** — pipeline que corre en cada PR que
   toca archivos de ese servicio:
   ```yaml
   on:
     push:
       paths:
         - 'chatia-backend/**'
         - 'packages/**'
   jobs:
     test:
       steps:
         - pnpm install
         - pnpm typecheck
         - pnpm test
         - pnpm build
   ```

2. **Typecheck como gate de PR** — si `tsc --noEmit` falla, el PR no puede
   mergearse. Esto es el enforcement del contrato de tipos entre servicios.

3. **Tests como gate de PR** — cuando existan tests (Fase 1 → Fase 6),
   cobertura mínima 85% en paths críticos como condición de merge.

4. **Deploy automático en Railway** — Railway ya hace deploy en push a main.
   Confirmar que el orden es: build → migrate → start, no build → start → migrate.

5. **Rollback documentado** — procedimiento claro para volver a la versión
   anterior si un deploy rompe producción. Railway mantiene el build anterior.

6. **Builds separados por servicio** — un cambio en `chatia-backend` no debe
   triggear rebuild de `pasarelapagos-backend`. Confirmar path filters en Railway.

### Cómo saber que este escalón está completo

- GitHub Actions corre en cada PR con `typecheck` + `build`
- Un PR que rompe `tsc` no puede mergearse
- Deploy en Railway es automático en merge a main
- Rollback documentado y probado al menos una vez

---

## Escalón 6 — Observabilidad y Operaciones

### Qué significa para ecosistema-ms

Logging estructurado en JSON, métricas de Prometheus, health checks reales,
trazabilidad de requests entre servicios, alertas cuando algo falla.

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| Health checks | ✅ Implementado | `GET /health` en los 5 servicios via `@nestjs/terminus` |
| Métricas Prometheus | ✅ Parcial | `prom-client` en notificaciones, analytics, workers |
| Logging estructurado | ⚠️ Verificar | Confirmar que los logs son JSON, no texto plano |
| Trazabilidad gRPC | ❌ No implementado | Sin correlation ID entre servicios |
| Alertas | ❌ No implementado | Sin alertas configuradas |

### Qué hay que hacer

1. **Logging JSON estructurado** — cada log debe tener:
   ```json
   {
     "level": "error",
     "service": "chatia-backend",
     "ecosystemId": "welver",
     "organizationId": "org_123",
     "correlationId": "req_abc",
     "message": "Conversation not found",
     "timestamp": "2026-09-01T00:00:00Z"
   }
   ```

2. **Correlation ID entre servicios** — generar un `correlationId` en el
   primer request HTTP/gRPC y propagarlo en todos los calls subsiguientes.
   Sin esto, trazar un error a través de chatia → analytics → workers es imposible.

3. **Métricas Prometheus en todos los servicios** — estandarizar las métricas
   que expone cada servicio:
   - `http_requests_total` por endpoint, método y status code
   - `grpc_requests_total` por método y status
   - `bullmq_jobs_completed_total` / `bullmq_jobs_failed_total`
   - `prisma_query_duration_seconds`

4. **Health check real** — el `/health` actual verifica memoria y Prisma.
   Agregar verificación de Redis y de la conexión gRPC a servicios dependientes.

5. **Alertas básicas** — cuando el health check falla más de 2 veces
   consecutivas → notificación (email, Slack, webhook). Railway puede
   configurar esto con su sistema de alertas.

6. **Dashboard mínimo** — Grafana o Railway metrics: ver en un vistazo
   si los 5 servicios están saludables y cuál es el throughput actual.

### Cómo saber que este escalón está completo

- Todos los logs son JSON con `ecosystemId`, `organizationId`, `correlationId`
- Prometheus `/metrics` activo en los 5 servicios con las métricas estándar
- Un request a chatia que falla puede trazarse hasta analytics en los logs
- Alerta configurada cuando `/health` falla
- Dashboard básico con estado de los 5 servicios
EOF
echo "✓ lifecycle/02-fase-estabilizacion.md"

# =============================================================================
# 03-fase-hardening.md — Escalones 7, 8, 10
# =============================================================================
cat > "$LIFECYCLE_DIR/03-fase-hardening.md" << 'EOF'
# Fase 3 — Hardening
## Escalones 7, 8, 10 — Primer ecosistema en producción

**Estado:** ⚪ Pendiente — iniciar cuando Fase 2 esté completa
**Cuándo:** Cuando el primer ecosistema real (welver) empieza a recibir usuarios
**Referentes:** Snyk/CrowdStrike (seguridad) · Apple (privacidad) · Kafka/Redis (async)

---

## Escalón 7 — Seguridad Defensiva (SecOps)

### Qué significa para ecosistema-ms

Escaneo continuo de vulnerabilidades en dependencias, protección contra
fuerza bruta y abuso de API, protocolos de respuesta a incidentes.

### Qué hay que hacer

1. **Escaneo de dependencias en CI** — agregar `pnpm audit` en el pipeline
   de GitHub Actions. Fallar el build si hay vulnerabilidades críticas o altas.
   Opcionalmente integrar Snyk para alertas automáticas.

2. **Rate limiting por ecosistema** — el endpoint público de chatia-backend
   (widget de chat) puede ser abusado. Limitar por `ecosystemId` + IP:
   ```ts
   // X requests por minuto por ecosystemId
   // X requests por minuto por IP (protección contra DDoS básico)
   ```

3. **API keys rotables para tenants** — `pasarelapagos-backend` tiene
   `api-key.service.ts`. Verificar que las keys pueden rotarse sin downtime
   y que las viejas expiran correctamente.

4. **Protección contra inyección** — Prisma ORM protege contra SQL injection
   por diseño. Verificar que ningún servicio usa `$queryRaw` con interpolación
   de strings sin sanitizar.

5. **Logs de seguridad separados** — autenticaciones fallidas, intentos de
   acceso cross-tenant, rate limit hits — deben loguearse con nivel `warn`/`error`
   y un campo `securityEvent: true` para poder filtrarlos.

6. **Runbook de incidente de seguridad** — qué hacer si se detecta acceso
   no autorizado. Debe existir antes de producción, no después de un incidente.

### Cómo saber que este escalón está completo

- `pnpm audit` en CI — 0 vulnerabilidades críticas o altas
- Rate limiting activo en endpoints públicos de chatia y pagos
- Logs de seguridad filtrables en producción
- Runbook de incidente de seguridad documentado

---

## Escalón 8 — Cumplimiento Legal y Privacidad

### Qué significa para ecosistema-ms

Cifrado de datos sensibles en tránsito y reposo, manejo correcto de PII,
términos de servicio, adherencia a normativas de privacidad (GDPR/LGPD según región).

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| HTTPS (tránsito) | ✅ Railway | TLS automático |
| PII service | ✅ Implementado | `pasarelapagos-backend/src/common/services/pii.service.ts` |
| Cifrado en reposo | ⚠️ Verificar | Railway PostgreSQL — confirmar cifrado a nivel de disco |
| Datos de pago | ⚠️ Parcial | PII service existe — verificar cobertura completa |
| Retención de datos | ❌ No definido | Política de cuánto tiempo se guardan conversaciones, pagos, etc. |
| Derecho al olvido | ❌ No implementado | Proceso para eliminar datos de un usuario a pedido |

### Qué hay que hacer

1. **Auditar cobertura del PII service** — verificar que todos los datos
   de tarjetas, documentos de identidad y datos bancarios pasan por
   `pii.service.ts` antes de persistirse. Ningún dato PII en texto plano en DB.

2. **Política de retención de datos** — definir y documentar:
   - Conversaciones: ¿cuánto tiempo se guardan?
   - Pagos: ¿qué datos se retienen y por cuánto tiempo? (requisito legal)
   - Logs: ¿cuánto tiempo en producción?

3. **Soft-delete como estándar** — conversaciones y contactos ya tienen
   soft-delete en chatia-backend. Verificar que todos los modelos con datos
   de usuarios tienen `deletedAt` y no se eliminan físicamente por defecto.

4. **Endpoint de eliminación de datos** — para cumplir GDPR/LGPD:
   un endpoint que elimine todos los datos de un usuario a pedido.
   Documentar el proceso aunque sea manual al principio.

5. **Separación de datos entre ecosistemas** — confirmar que welver,
   manzana y mexus no pueden acceder a datos del otro. El `ecosystemId`
   en cada query es la garantía técnica — el test de cross-tenant es la prueba.

### Cómo saber que este escalón está completo

- Ningún dato PII en texto plano en ninguna tabla de DB
- Política de retención de datos documentada y configurada
- Proceso de eliminación de datos documentado (aunque sea manual)
- Test de cross-tenant: request de welver no retorna datos de manzana

---

## Escalón 10 — Datos Masivos y Procesamiento Asíncrono

### Qué significa para ecosistema-ms

BullMQ bajo carga real, estrategia de caché coherente, patrones de
lectura/escritura escalables cuando hay múltiples ecosistemas concurrentes.

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| BullMQ queues | ✅ Implementado | chatia, notificaciones, workers tienen queues |
| DLQ (Dead Letter Queue) | ✅ Implementado | chatia, notificaciones, workers tienen DLQ |
| Redis caché | ✅ Implementado | `cache.service.ts` en chatia-backend |
| Circuit breaker | ✅ Implementado | `circuit-breaker.service.ts` — pero en memoria |
| Reintentos configurados | ⚠️ Verificar | Confirmar retry policy en cada queue |
| Concurrencia de workers | ⚠️ Verificar | Cuántos jobs simultáneos procesa cada worker |
| Circuit breaker distribuido | ❌ No implementado | Opera en memoria — no funciona con múltiples réplicas |

### Qué hay que hacer

1. **Documentar y verificar retry policy por queue** — cada queue de BullMQ
   debe tener configurado:
   - `attempts`: cuántos reintentos
   - `backoff`: tiempo entre reintentos (exponential recomendado)
   - `removeOnComplete` / `removeOnFail`: política de limpieza

2. **Circuit breaker distribuido** — el `CircuitBreakerService` actual opera
   en memoria. Con más de 1 réplica en Railway, cada réplica tiene su propio
   estado de circuit breaker. Migrar a Redis para estado compartido.

3. **Caché por ecosystemId** — la clave de caché en `cache.service.ts` debe
   incluir `ecosystemId` para evitar que datos de welver cacheen datos de manzana.
   ```ts
   // ❌ Clave sin scope
   cacheKey = `conversation:${conversationId}`
   // ✅ Clave con scope
   cacheKey = `${ecosystemId}:conversation:${conversationId}`
   ```

4. **Monitoreo de queues** — con Bull Board o similar: ver en tiempo real
   cuántos jobs están en cola, cuántos fallaron, cuántos están procesando.
   Antes de producción con 3 ecosistemas, necesitás visibilidad.

5. **Límites de concurrencia** — definir cuántos jobs simultáneos procesa
   `workers-backend` para campañas. Sin límite, una campaña grande de welver
   puede saturar el worker y demorar las campañas de manzana.

6. **Aislamiento de queues por ecosistema** — evaluar si queues separadas
   por ecosistema o prioridad por `ecosystemId` dentro de la misma queue.

### Cómo saber que este escalón está completo

- Retry policy documentada y configurada en todas las queues
- Circuit breaker con estado en Redis (no en memoria)
- Todas las claves de caché incluyen `ecosystemId`
- Dashboard de queues (Bull Board) activo
- Límites de concurrencia documentados y configurados
EOF
echo "✓ lifecycle/03-fase-hardening.md"

# =============================================================================
# 04-fase-escala.md — Escalones 9, 11, 12, 13
# =============================================================================
cat > "$LIFECYCLE_DIR/04-fase-escala.md" << 'EOF'
# Fase 4 — Escala
## Escalones 9, 11, 12, 13 — 3 ecosistemas simultáneos

**Estado:** ⚪ Pendiente — iniciar cuando Fase 3 esté completa
**Cuándo:** Cuando welver, manzana y mexus operan simultáneamente con tráfico real
**Referentes:** AWS (DR) · Linear/Figma (UX) · Netflix (Chaos) · Airbnb/Uber (FinOps)

---

## Escalón 9 — Recuperación ante Desastres

### Qué significa para ecosistema-ms

Si Railway cae, si una DB se corrompe, si un servicio queda en estado inconsistente —
cuánto tiempo tarda en recuperarse (RTO) y cuántos datos se pierden como máximo (RPO).

### Qué hay que hacer

1. **Definir RTO y RPO por servicio** — antes de que ocurra el desastre:
   | Servicio | RTO objetivo | RPO objetivo |
   |---|---|---|
   | chatia-backend | < 5 min | < 1 min (BullMQ persistent) |
   | pasarelapagos-backend | < 2 min | 0 (transacciones financieras) |
   | notificaciones-backend | < 10 min | < 5 min |
   | analytics-backend | < 15 min | < 1 hora (datos analíticos) |
   | workers-backend | < 10 min | < 5 min (jobs reintentables) |

2. **Backups automáticos verificados** — confirmar que Railway PostgreSQL
   hace backups y probar una restauración real. Un backup que nunca se probó
   no existe.

3. **Estado de BullMQ en Redis persistente** — confirmar que Redis tiene
   `appendonly yes` (AOF) para que los jobs no se pierdan si Redis reinicia.

4. **Runbook de recuperación por escenario** — documentar paso a paso:
   - "La DB de chatia-backend se corrompió" → qué hacer
   - "Railway está caído" → qué hacer
   - "Un servicio quedó en loop de crash" → qué hacer

5. **Drill de recuperación** — al menos una vez antes de escalar a 3
   ecosistemas: simular la caída de un servicio y medir el RTO real.

### Cómo saber que este escalón está completo

- RTO y RPO definidos y documentados por servicio
- Restauración de backup probada exitosamente en staging
- Runbooks de recuperación escritos para los 3 escenarios más probables
- Redis con persistencia AOF confirmada

---

## Escalón 11 — Rendimiento Percibido y UX (Latency-Zero)

### Qué significa para ecosistema-ms

Los consumidores de ecosistema-ms (los frontends de welver, manzana, mexus)
deben percibir respuestas en menos de 100ms para operaciones comunes.

### Qué hay que hacer

1. **Medir latencias actuales por endpoint** — antes de optimizar, medir.
   Agregar `p50`, `p95`, `p99` de latencia en las métricas de Prometheus.

2. **Caché de respuestas frecuentes** — las respuestas de configuración de
   agente, FAQ más consultadas, y preferencias de notificación son candidatas
   a caché con TTL corto.

3. **Paginación en todos los listados** — `conversations/list`, `contacts/list`,
   `messages/list` — ningún endpoint devuelve un array sin límite.
   Sin paginación, el primer cliente con 10.000 conversaciones rompe la API.

4. **Índices de DB optimizados** — medir las queries más lentas con
   `EXPLAIN ANALYZE` en PostgreSQL. Un query sin índice que tarda 2ms
   con 100 registros tarda 2 segundos con 100.000.

5. **gRPC streaming para chat** — el chat en tiempo real no debería ser
   polling. Si hoy es polling, evaluar gRPC server streaming para mensajes.

6. **Optimistic updates en los frontends** — los frontends de los ecosistemas
   deben actualizar la UI antes de recibir confirmación del back para
   operaciones de baja criticidad (marcar mensaje como leído, etc.).

### Cómo saber que este escalón está completo

- `p95` de latencia < 100ms en endpoints principales con carga simulada
- Todos los listados tienen paginación (`limit` + `cursor` o `page`)
- Métricas de latencia visibles en dashboard

---

## Escalón 12 — Alta Disponibilidad Global y Chaos Engineering

### Qué significa para ecosistema-ms

El sistema sigue funcionando cuando un servicio cae, cuando Railway tiene
un incidente parcial, o cuando una queue se satura.

### Qué hay que hacer

1. **Múltiples réplicas en Railway** — configurar al menos 2 réplicas de
   `chatia-backend` y `pasarelapagos-backend` en Railway. Si una réplica
   muere, la otra sigue sirviendo.

2. **Circuit breaker distribuido activo** — cuando `analytics-backend` está
   caído, `chatia-backend` no debe fallar — debe degradarse (skip analytics)
   y continuar. El circuit breaker en Redis gestiona esto.

3. **Health checks con degradación** — el `/health` debe distinguir entre:
   - `status: "ok"` — todo funciona
   - `status: "degraded"` — funciona pero con dependencias caídas
   - `status: "down"` — no puede servir requests

4. **Chaos Engineering básico** — antes del 1% mundial, hacer:
   - Apagar manualmente `analytics-backend` → verificar que chatia sigue funcionando
   - Saturar la queue de workers → verificar que chatia no se degrada
   - Cortar Redis → verificar fallback a MemoryCache

5. **Documentar los resultados del chaos** — qué se rompió, qué no se rompió,
   qué se arregló. Eso es el Chaos Engineering real.

### Cómo saber que este escalón está completo

- 2+ réplicas de servicios críticos en Railway
- Chaos drill documentado con resultados
- Circuit breaker distribuido (Redis) activo y probado
- Health check con tres estados implementado

---

## Escalón 13 — Eficiencia Financiera (FinOps)

### Qué significa para ecosistema-ms

Saber exactamente cuánto cuesta servir a cada ecosistema, escalar solo
lo que necesita escalar, y predecir el costo de agregar un ecosistema nuevo.

### Qué hay que hacer

1. **Costo por ecosistema** — poder responder: "¿cuánto nos cuesta mensualmente
   servir a welver?" Railway expone métricas de consumo por servicio.
   Con `ecosystemId` en los logs, se puede aproximar el costo por cliente.

2. **Escalado automático** — Railway puede escalar réplicas según CPU/memoria.
   Configurar: escalar hacia arriba cuando CPU > 70%, escalar hacia abajo
   cuando CPU < 20% por más de 5 minutos.

3. **Costo marginal por ecosistema nuevo** — antes de incorporar el cuarto
   ecosistema, calcular: ¿cuánto recursos adicionales consume?
   La respuesta debe ser predecible, no una sorpresa.

4. **Optimizar workers-backend** — los jobs de campaña son la operación más
   cara en términos de CPU/tiempo. Medir costo por campaña procesada y
   optimizar el throughput del worker.

5. **TTL de caché como palanca de costo** — un TTL más largo en Redis reduce
   queries a DB y reduce costo de cómputo. Un TTL más corto da datos más
   frescos pero cuesta más. Documentar la decisión por tipo de dato.

### Cómo saber que este escalón está completo

- Dashboard de costos con breakdown por servicio (Railway)
- Escalado automático configurado en servicios con carga variable
- Costo estimado de un nuevo ecosistema documentado antes de incorporarlo
EOF
echo "✓ lifecycle/04-fase-escala.md"

# =============================================================================
# 05-tasks.md — Tasks concretas para escalar a cada fase
# =============================================================================
cat > "$LIFECYCLE_DIR/05-tasks.md" << 'EOF'
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
EOF
echo "✓ lifecycle/05-tasks.md"

# =============================================================================
# Resumen final
# =============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ .claude/lifecycle/ inicializado exitosamente"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Archivos creados:"
find "$LIFECYCLE_DIR" -type f | sort | sed "s|$ROOT_DIR/||"
echo ""
echo "Total: $(find "$LIFECYCLE_DIR" -type f | wc -l) archivos · 63 tasks en 4 fases"
echo ""
echo "Próximos pasos:"
echo "  1. git add .claude/lifecycle/ && git commit -m 'chore: agregar lifecycle al .claude/'"
echo "  2. Arrancar con [E1-01] — ZodValidationPipe en chatia-backend"
echo ""