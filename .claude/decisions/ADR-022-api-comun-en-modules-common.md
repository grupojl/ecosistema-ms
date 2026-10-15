# ADR-022 — `src/` con solo core / infrastructure / modules; API común en `modules/common/`

**Fecha:** 2026-10-15 · **Estado:** Aceptado — aplicado en chatia-backend (2026-10-15); **pendiente en los otros 5 servicios**

## Contexto
La arquitectura (`01-capas-microservicio.md`) dice que `core/` no tiene controllers y que los endpoints viven en
`modules/`. En chatia-backend había 10 controllers dentro de `core/`. Los ecosistemas (Welver, Manzana, Mexus y los
que vengan) usan la misma superficie de API con propósitos distintos; el comportamiento propio de cada uno ya vive
en su `ProjectStrategy`.

## Decisión
1. **Endpoints comunes** → `modules/common/<dominio>/` (módulo `CommonApiModule`), rutas `/api/v1/...` sin cambios,
   ecosistema resuelto por el token.
2. **Endpoints exclusivos de un ecosistema** → `modules/<eco>/`, bajo `/api/<eco>/v1/...`, solo cuando existan.
3. **Personalización por ecosistema** → strategy + config + flags/limits de la organización, nunca ramas
   `if (eco === ...)` en controllers.
4. `core/` no tiene `@Controller` ni importa de `modules/`; `modules/<eco>` no importa de otro ecosistema ni de
   `modules/common`; `modules/common` no importa de ecosistemas. Lo fuerza `src/architecture.spec.ts`.
5. Agregar un ecosistema = copiar la carpeta de Welver, ajustar strategy/config y sumarlo a `modules/index.ts`.

6. **La raíz de `src/` tiene solo `core/`, `infrastructure/` y `modules/`** (más `main.ts`, `app.module.ts` y `generated/` de Prisma, que es salida de herramienta). Mapa: webhooks/widget/channel-accounts/agent-notifications →
   controller en `modules/common/` + lógica en `core/`; channels, events, queue, maintenance → `infrastructure/`;
   health, internal, grpc → `infrastructure/transport/`; privacy → `core/privacy/`; test → `infrastructure/testing/`.
7. Herramienta: `.claude/tools/restructure-src.js` (mueve con git mv y reescribe imports). Hay que adaptar sus mapas a cada servicio.

## Referencias de industria
Salesforce (API común + extensiones por vertical, configuración por metadatos) y Stripe (API única, tenant en la
autenticación, versionado explícito).

## Consecuencias
- Sin cambio de rutas: no se rompe ningún consumidor.
- Los schemas Zod quedan en `core/<dominio>/schemas.ts` (los servicios usan sus tipos).
- `agents` ahora tiene domain + service + repository (el controller ya no usa Prisma). De paso: `POST /agents/register` exige
  token (TenantGuard) y toma la identidad del token (antes era público y confiaba en `organizationId`/`firebaseUid` del body); un
  miembro solo edita su propio perfil, `role`/`isActive` son de OWNER/ADMIN.
- Las implementaciones Prisma de contacts, conversations, organization-config y agents viven en
  `infrastructure/prisma/repositories/`; el binding token → implementación está en `infrastructure/prisma/prisma.module.ts`.
- Verificado en chatia: tsc, eslint, build, 457 tests unitarios y 31 de integración (Postgres real) en verde tras la mudanza.
- **Prisma saldado (2026-10-15)**: `core/` y `modules/` no importan `PrismaService` (test estricto). Persistencia = repositories en `infrastructure/prisma/repositories/`, cubiertos por tests de integración contra Postgres real y excluidos del % de cobertura unitaria.
- Deuda restante con **trinquete** en `architecture.spec.ts`: 13 archivos de `core/` importan `infrastructure/queue|channels|events`. La lista solo puede achicarse; meta = vacía.
