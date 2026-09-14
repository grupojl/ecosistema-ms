# ADR-008 — Plan hacia 10/10: Tests · Observabilidad · CI/CD

**Estado:** Aceptado — En ejecución
**Fecha:** 2025-Q3
**Owner:** Equipo ecosistema-ms

---

## Contexto

Evaluación puntual de ecosistema-ms (sept 2025):

| Dimensión              | Puntaje antes |
|------------------------|---------------|
| Arquitectura/Capas     | 7.2 / 10      |
| Tests                  | 3.5 / 10      |
| Observabilidad         | 2.5 / 10      |
| Deploy / CI/CD         | 6.0 / 10      |
| **Promedio real**      | **~5.8 / 10** |

Los tres pilares que arrastran el promedio son exactamente los que este
ADR ataca. La base arquitectónica es correcta — el problema es que sin tests,
sin trazas y sin CI, no se puede operar con confianza en producción.

---

## Decisiones

### D1 — Tests: cobertura real y enforcement en CI

**Objetivo:** 3.5 → 9.0

**Qué implementamos:**

1. **Unit tests de dominio** — lógica de negocio pura sin mocks de Prisma.
   Cada `domain/*.entity.ts` tiene su suite en `*.entity.spec.ts`.
   Cada `*.service.ts` tiene su suite con el repository mockeado via interface.

2. **Integration tests de contratos HTTP** — `supertest` contra el módulo
   completo de NestJS con Prisma mockeado vía `@prisma/client` mock.
   Paths críticos: payments, conversations, auth.

3. **Cobertura mínima enforceada en CI:**
   - Statements: 85%
   - Branches: 80%
   - Functions: 85%
   - Lines: 85%
   Configurado en `jest.config.ts` de cada servicio con `coverageThreshold`.

4. **Test de aislamiento multi-tenant** — suite que verifica que un request con
   `ecosystemId=welver` nunca retorna datos con `ecosystemId=manzana`.
   Vive en `*/src/test/multitenant.spec.ts` de cada servicio.

**Por qué no pytest / Vitest:**
Jest es el estándar del monorepo. Cambiar en este punto introduce overhead
de configuración sin ganancia real. Se descarta.

**Por qué no solo integration tests:**
Los tests de dominio puro validan invariantes de negocio sin levantar la app.
Son 10x más rápidos y sobreviven refactors de infraestructura.

---

### D2 — Observabilidad: trazas distribuidas y métricas estructuradas

**Objetivo:** 2.5 → 8.5

**Qué implementamos:**

1. **Request ID propagado entre servicios**
   - Cada request HTTP entrante recibe un `X-Request-Id` (UUID v4) si no trae uno.
   - El `TenantGuard` lo agrega al contexto de AsyncLocalStorage.
   - Los clientes gRPC lo propagan en el metadata del call.
   - Todos los logs incluyen `{ requestId, ecosystemId, organizationId, service }`.

2. **Logs estructurados (JSON) en producción**
   - `pino` como logger de NestJS en producción. En local: `pino-pretty`.
   - Se configura en `main.ts` de cada servicio con `createPinoLogger()`.
   - Formato: `{ timestamp, level, service, requestId, ecosystemId, message, ...context }`.

3. **Métricas Prometheus en `/metrics`**
   - `@willsoto/nestjs-prometheus` en cada servicio.
   - Métricas base: `http_request_duration_seconds`, `http_requests_total`,
     `bullmq_job_duration_seconds`, `bullmq_job_failures_total`.
   - Métricas de negocio: `grpc_calls_total`, `circuit_breaker_state` (open/closed/half-open).
   - El endpoint `/metrics` es interno (no expuesto públicamente en Railway).

4. **Health check enriquecido**
   - `GET /health` retorna estado de: DB, Redis, BullMQ, circuit breakers por canal.
   - Formato compatible con Railway health checks.

5. **Circuit breaker state en métricas**
   - `CircuitBreakerService` expone estado via gauge Prometheus.
   - Cuando un CB está OPEN, hay alerta automática en el dashboard.

**Por qué no OpenTelemetry completo ahora:**
OTEL con collector distribuido (Jaeger/Tempo) requiere infraestructura Railway adicional.
El approach pino + Prometheus cubre el 90% del valor con el 20% de la complejidad.
OTEL queda en Fase Hardening como upgrade natural.

**Por qué no Datadog/New Relic:**
Costo operacional. Prometheus + Grafana Cloud free tier cubre la fase actual.

---

### D3 — CI/CD: pipeline que bloquea antes de Railway

**Objetivo:** 6.0 → 9.0

**Qué implementamos:**

1. **GitHub Actions — pipeline por servicio afectado**

   Trigger: push a `main` o PR abierto.
   Detección de cambios: `dorny/paths-filter` por carpeta de servicio.
   Solo corre el pipeline del servicio que cambió + `packages/`.

   Jobs en orden:
   ```
   lint → typecheck → test (con cobertura) → build → [deploy en main]
   ```

2. **Lint + typecheck en cada PR (< 2 min)**
   ```yaml
   - pnpm run lint --filter={servicio}
   - pnpm run typecheck --filter={servicio}
   ```
   Un PR que no pasa typecheck no se puede mergear.

3. **Tests con cobertura mínima (bloquea merge)**
   ```yaml
   - pnpm run test:cov --filter={servicio}
   ```
   Si coverage < threshold configurado en jest → workflow falla → no se mergea.

4. **Build Docker por servicio (verifica que la imagen se construye)**
   ```yaml
   - docker build -f {servicio}/Dockerfile -t {servicio}:${{ github.sha }} .
   ```
   Corre en `main` antes del deploy. Si el build falla, Railway no recibe el push.

5. **Deploy automático en Railway solo desde `main`**
   Railway ya escucha el repo. El CI no dispara Railway — Railway detecta el merge.
   El valor del CI es **bloquear antes** de que llegue a Railway.

6. **Branch protection rules en GitHub**
   - Required status checks: `lint`, `typecheck`, `test`, `build`
   - Require PR review: 1 aprobación mínima
   - No force push a `main`

**Regla permanente:**
Un push directo a `main` sin pasar el pipeline es un accidente, no un shortcut.
Railway puede desplegar código roto si el CI no existe — ese riesgo se elimina aquí.

---

## Tabla de impacto por decisión

| Decisión | Tests | Observabilidad | Deploy | Arquitectura |
|----------|-------|----------------|--------|--------------|
| D1 Tests | +5.5  | —              | —      | +0.3         |
| D2 Obs   | —     | +6.0           | —      | +0.2         |
| D3 CI/CD | +0.5  | —              | +3.0   | —            |

## Proyección post-implementación

| Dimensión          | Antes | Después |
|--------------------|-------|---------|
| Arquitectura       | 7.2   | 8.5     |
| Tests              | 3.5   | 9.0     |
| Observabilidad     | 2.5   | 8.5     |
| Deploy / CI/CD     | 6.0   | 9.0     |
| **Promedio real**  | 5.8   | **8.8** |

El salto al 9.5+ viene del tiempo bajo carga real en producción,
no de una decisión de arquitectura.

---

## Orden de ejecución recomendado

1. D3 CI/CD — bloquea regresiones desde el primer día (valor inmediato)
2. D2 Observabilidad — sin esto operar en producción es ciego
3. D1 Tests — la cobertura se construye módulo a módulo en paralelo con features

---

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| Playwright E2E como suite principal | Los servicios son APIs — E2E tiene valor pero no es el cuello de botella ahora |
| OpenTelemetry completo desde el inicio | Requiere collector, storage, dashboard — overhead alto. Pino+Prometheus cubre el valor inmediato |
| Turborepo para CI | pnpm --filter ya resuelve el problema. Turborepo agrega complejidad sin ganancia suficiente ahora |
| Jest → Vitest | El costo de migración supera la ganancia de velocidad en este tamaño de suite |

## Referencias

- `checklists/testing-desde-cero.md`
- `checklists/observabilidad.md`
- `conventions/testing.md`
- `conventions/deploy.md`
- `lifecycle/02-fase-estabilizacion.md`
