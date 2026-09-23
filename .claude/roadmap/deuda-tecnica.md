# Deuda técnica — ecosistema-ms

Última actualización: 2026-09-19

---

## Cerrado en sesión 2026-09-19 ✅

- [x] /health extendido (ExtendedHealth) en los 5 MS
- [x] InternalModule en chatia, pasarela y workers
- [x] InternalApiKeyGuard

---

## Pendiente activo

### [ECO-MS-01] INTERNAL_API_KEY en Railway — P0 para producción
Configurar la misma clave en todos los servicios.
Sin esto, superadmin recibe 403 en todos los /internal/*.

### [ECO-MS-02] conversations.service.updated.ts en chatia — P1
Archivo duplicado sin usar. Eliminar:
`chatia-backend/src/conversations/conversations.service.updated.ts`

### [ECO-MS-03] make typecheck en cada MS — P1
Correr antes del próximo deploy:
```bash
pnpm --filter chatia-backend typecheck
pnpm --filter pasarelapagos-backend typecheck
pnpm --filter workers-backend typecheck
pnpm --filter notificaciones-backend typecheck
pnpm --filter analytics-backend typecheck
```

---

## Deuda técnica preexistente (no tocada en esta sesión)

- main.ts con ValidationPipe global coexiste con ZodExceptionFilter (DT-027)
  — documentado, no rompe, se resuelve en S4
- DT-ECO-01 (domain/repo en ecommerce-back) — cerrado en sesión 2026-09-17

---

## Sprint Markets — ADR-014 ✅ COMPLETADO 2026-09-21

### Cerrado
- [x] MKT-PKG-01: TenantContext.marketCountry? en packages/auth-server
- [x] MKT-PKG-02: TenantGuard extrae X-Market-Country
- [x] MKT-CH-01/02/03: TenantContext local + TenantGuard chatia + Prisma Conversation
- [x] MKT-PP-01: Prisma Payment.market_country
- [x] MKT-AN-01: Prisma AnalyticsEvent.market_country + índice

### Pendiente siguiente sprint
- [ ] MKT-CH-04: system prompt contextualizado por país en agente chatia
- [ ] MKT-PP-02/03: marketCountry en PaymentController + listados
- [ ] MKT-AN-02/03: marketCountry en gRPC TrackEvent + proyecciones por Market
- [ ] Migraciones Prisma (requieren DB): chatia + pasarela + analytics

---

## Observabilidad ✅ COMPLETADA 2026-09-21

- [x] LoggerModule + PrometheusModule + RequestIdMiddleware en los 5 servicios
- [x] Health checks extendidos: DB + Redis + CBs + DLQ + uptime + version
- [x] grpc-metadata.helper.ts: X-Request-Id propagado en gRPC inter-servicio
- [x] ci-packages.yml: CI para proto + auth-server + grpc-client
- [x] pino-pretty en catalog + RequestIdMiddleware en pasarelapagos

### Pendiente
- [ ] Adopción de grpcMetadata() en callers concretos
- [ ] Branch protection en GitHub
- [ ] pnpm install para regenerar lockfile

---

## ProjectStrategy — scaffold + tipado pendiente (ADR-019, 2026-09-23)

### [ECO-PS-01] Wiring manual de app.module.ts — P0
`pasarelapagos-backend` y `notificaciones-backend` tienen `core/strategies/`
y `modules/{welver,manzana,mexus}/` generados, pero **no están importados**
en `app.module.ts` todavía. Sin esto el registry nunca se inicializa.

```ts
// pasarelapagos-backend/src/app.module.ts y notificaciones-backend/src/app.module.ts
import { ProjectStrategyModule } from '@/core/strategies/project-strategy.module';
import { WelverModule }  from '@/modules/welver/welver.module';
import { ManzanaModule } from '@/modules/manzana/manzana.module';
import { MexusModule }   from '@/modules/mexus/mexus.module';
// agregar los 4 al array imports: []
```

### [ECO-PS-02] Estrategias son placeholders vacíos — P1
`{eco}.strategy.ts` en pasarelapagos-backend y notificaciones-backend tienen
`businessData: {}` y comentarios `TODO`. Igual que las estrategias de
chatia-backend — hoy son la estructura correcta esperando contenido real.
Completar cuando cada ecosistema defina su lógica de routing/templates real.

### [ECO-PS-03] `businessData: Record<string, unknown>` sin tipar — P2
Deuda consciente documentada en ADR-019. Aceptable con 3 ecosistemas en
placeholder. Bloqueante apenas la primera estrategia tenga lógica real —
tipar con un shape concreto por ecosistema en `modules/{eco}/types/context.ts`
en vez de dejar `Record<string, unknown>`.

### [ECO-PS-04] Evaluar marketing-backend — P3, no urgente
Candidato a Strategy (reglas de automatización por ecosistema) pero fuera
de scope de esta iteración. No agregar preventivamente — ver criterio de
decisión en `architecture/12-project-strategy-pattern.md`.
