# ADR-018: Política de dependencias — una versión, declarada donde se usa, con dueño

**Fecha:** 2026-09-22
**Estado:** Propuesto
**Alcance:** Transversal — mismo número en welver, ecosistema-ms y grupojl-control
**Complementa:** restricción de catalog único documentada en `pnpm-workspace.yaml` (welver ADR-002)
**Guía operativa:** `architecture/11-dependencias-norte.md`

## Contexto

Auditoría del 2026-09-22 sobre los 10 workspaces de ecosistema-ms (`package.json`
resueltos contra el catalog + imports reales de `src/`):

- **Install roto:** `analytics`, `chatia`, `notificaciones` y `pasarelapagos` declaran
  `"/nestjs-prometheus"` y `"-ms/auth-server"` — nombres sin scope, muy probablemente
  producto de un reemplazo masivo mal escapado. Un solo `package.json` inválido rompe
  `pnpm install` del workspace completo, y con él el build de los 5 servicios en Railway.
- **Catalog irresoluble:** `workers-backend` declara `@nestjs-modules/nestjs-prometheus:
  catalog:` y `packages/logger` declara `pino-pretty: catalog:`; ninguno de los dos
  existe en el catalog.
- **Imports que ningún workspace declara:** `chatia-backend` usa `@nestjs/websockets`
  (`src/events/events.gateway.ts`) y `redis` (`src/common/services/cache.service.ts`);
  `workers-backend` usa `@nestjs-modules/ioredis` (`src/campaigns/campaigns.service.ts`)
  y `mammoth` / `pdf-parse` por import dinámico (compila, falla en runtime).
- **Phantom deps enmascaradas por `shamefully-hoist=true`:** `opossum` (chatia,
  notificaciones — solo lo declara pasarelapagos), `@opentelemetry/*` (pasarelapagos,
  notificaciones, workers), `zod` (analytics, notificaciones, workers), `nestjs-pino`
  (chatia), `@nestjs/config` (`packages/grpc-client`).
- **Fuera del catalog:** `socket.io` y `@types/multer` (chatia); `compression`,
  `cookie-parser`, `nanoid`, `opossum`, `@types/compression` y `@types/cookie-parser`
  (pasarelapagos — estos `@types` en `dependencies` llegan a la imagen de producción).
- **Claves duplicadas en `scripts`:** `test:cov` (analytics, chatia, pasarelapagos) y
  `typecheck` (analytics). Gana la última, en silencio.
- **Abstracciones sin consumidor:** `packages/logger` y `packages/metrics`; cada servicio
  redeclara pino y prom-client por su cuenta.
- **Dos clientes Redis:** `ioredis` (catalog) y `redis` (chatia).
- **Deriva entre repos:** Prisma 7.8 aquí, 7.4 en welver y 6.x en grupojl-control.
- `marketing-backend` figura en `pnpm-workspace.yaml`, pero su `package.json` no se auditó.

El patrón común es la ausencia de una política explícita y de verificación automática:
cada PR decide por su cuenta y `shamefully-hoist` esconde el resultado hasta que el
install entero se rompe.

## Decisión

Adoptamos una política única de dependencias para los tres monorepos, definida en
`architecture/11-dependencias-norte.md`:

1. **Una sola versión:** el `catalog:` es la única fuente de versiones (R1).
2. **Declarado donde se usa:** cero phantom deps; objetivo `shamefully-hoist=false` (R2).
3. **Libs internas con peers:** frameworks nunca en `dependencies` de `packages/*` (R3).
4. **Toda dependencia nueva pasa un checklist y tiene dueño** (R4).
5. **Upgrades continuos** con Renovate agrupado y semanal (R5).
6. **Cadena de suministro verificada:** lockfile congelado, `minimumReleaseAge`,
   OSV-Scanner (R6).

Adopción progresiva: **F0** bloqueantes → **F1** reporte sin bloquear → **F2** enforcement
en CI → **F3** alineación del núcleo entre repos.

## Alternativas descartadas

- **Mantener el status quo con `shamefully-hoist=true`** — enmascara phantom deps que
  explotan al cambiar de builder, al usar `pnpm deploy` o al borrar una dependencia en
  otro workspace. El costo aparece en producción, no en el PR.
- **Modelo Google literal (vendoring de `third_party/` + Bazel)** — resuelve todo, pero
  exige infraestructura y un equipo de build desproporcionados para nuestra escala.
- **Una política distinta por repo** — es exactamente lo que produjo la deriva actual
  (Prisma 6 / 7.4 / 7.8 entre los tres repos).
- **Pinning exacto de todo, sin `^`** — la reproducibilidad ya la da el lockfile; pinear
  sin un bot de upgrades congela también los parches de seguridad.
- **Dependabot en lugar de Renovate** — menos control sobre agrupamiento y aprobación
  de majors. Se reevalúa si cambia.

## Consecuencias

**Se gana:** builds reproducibles; errores de dependencias detectados en el PR y no en
Railway; upgrades chicos y frecuentes en vez de migraciones grandes; superficie de ataque
conocida y con dueño.

**Se sacrifica:** agregar una dependencia deja de ser un `pnpm add` de 5 segundos (requiere
checklist y aprobación); F0 y F2 consumen tiempo de sprint; `shamefully-hoist=false` puede
exigir `public-hoist-pattern` para tooling (Next, Nest CLI, Jest) — cada excepción se
documenta en el norte.

**Deuda consciente:** la alineación del núcleo entre repos (F3) y el mecanismo para
sincronizarlo quedan para un ADR aparte.

## Referencias

- `architecture/11-dependencias-norte.md` — reglas R1–R6, métricas, excepciones y plan
- `architecture/03-reglas-duras.md` — sección "Dependencias (post ADR-018)"
- `pnpm-workspace.yaml`, `.npmrc`, `*/package.json`, `packages/*/package.json`
- Titus Winters et al., *Software Engineering at Google*, cap. 21 "Dependency Management"
- Documentación de Rush: "Phantom dependencies" y "NPM doppelgangers"
- OpenSSF Scorecard · SLSA · OSV-Scanner
