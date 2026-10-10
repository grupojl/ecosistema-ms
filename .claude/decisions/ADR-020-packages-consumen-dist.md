# ADR-020 — Los servicios consumen `dist/` de `packages/*`, nunca `src/`

**Fecha:** 2026-10-08
**Estado:** Aceptado — implementado
**Repo:** grupojl/ecosistema-ms
**Referentes:** Vercel (Turborepo "internal packages compiled"), Stripe (builds independientes por servicio)

## Contexto

`auth-server`, `grpc-client` y `proto` exponían `"main"`/`"types"` apuntando a
`./src/index.ts` y su `build` era un `echo "ok"`. Cada servicio terminaba
compilando el TypeScript fuente de los packages dentro de su propio build:

- builds acoplados (un cambio en un package re-tipaba todo desde fuente en cada servicio)
- alias `@/` de los packages resueltos por el tsconfig del servicio consumidor
- Dockerfiles copiando `src/` de packages al runtime
- `logger`/`metrics` ya usaban `dist/` pero nunca habían compilado (errores latentes de tipos)

## Decisión

1. Todo package en `packages/*` **compila con `tsc` a `dist/`** y declara
   `main`, `types` y `exports` apuntando a `dist/`.
2. Los packages que usan alias `@/` resuelven el alias en el build con
   `tsc-alias` (`tsc -p tsconfig.json && tsc-alias -p tsconfig.json`).
3. Los servicios **solo ven `dist/`** de los packages (vía `exports`).
   Orden de build: `proto → auth-server → grpc-client` (pnpm lo ordena
   topológicamente con `pnpm build:packages`).
4. `typecheck` y `test` raíz corren `build:packages` primero.
5. CI: cada workflow de servicio ejecuta `pnpm build:packages` tras `pnpm install`.
6. Dockerfiles: el stage `build` compila los packages antes del servicio; el
   stage `runtime` copia `packages/` (con `dist/`) completo.

Turborepo queda diferido (ver `architecture/10-monorepo-estructura.md`, Nivel 2).

## Consecuencias

- ✅ Builds de servicios independientes del código fuente de packages
- ✅ Mismo artefacto en dev, CI y Docker
- ✅ Errores de tipos de packages se detectan al compilar el package
- ⚠️ Tras editar un package hay que recompilarlo (`pnpm build:packages` o `pnpm --filter <pkg> dev` en watch)
- ⚠️ Un package nuevo necesita `exports`, `build` con `tsc-alias` si usa `@/`, y entrada en los Dockerfiles que lo consuman

## Regla dura

🔴 Un servicio nunca importa `@ecosistema-ms/<pkg>/src/...` ni apunta
`paths`/`main` a `src/` de un package. Siempre `@ecosistema-ms/<pkg>` → `dist/`.

## Addendum 2026-10-08 — build de servicios y cliente Prisma

**Servicios (`nest build`):** los imports `@/…​.js` no se reescriben solos en `dist/` con
`moduleResolution: nodenext`, por lo que `node dist/main.js` fallaba con `MODULE_NOT_FOUND`.
Cada servicio compila ahora con `prisma generate && nest build && tsc-alias -p tsconfig.build.json`.
`tsconfig.build.json` fija `rootDir: ./src` (el entrypoint queda en `dist/main.js`, no `dist/src/main.js`)
e `incremental: false` (con `deleteOutDir`, el `.tsbuildinfo` viejo dejaba `dist/` sin `.js`).

**Cliente Prisma por servicio (2026-10-10):** el cliente compartido (`shamefully-hoist` → un solo
`@prisma/client` donde ganaba el último `prisma generate`) se reemplazó por un cliente propio por servicio:
- cada `schema.prisma` usa `provider = "prisma-client"` con `output = "../src/generated/prisma"` (ignorado por git);
- el código importa de `@/generated/prisma/client.js` (nunca de `@prisma/client`); tsc lo compila a `dist/generated/prisma`;
- `PrismaClient` exige `adapter` (PrismaPg) también en seeds fuera de `src/` (import relativo `../src/generated/prisma/client.js`);
- `start:dev`, `typecheck` y `build` ejecutan `prisma generate` antes; `pnpm dev` ya puede levantar los 6 en paralelo;
- Docker no cambia: la imagen genera su schema y compila a `dist/`.
