---
name: verify
description: Compuerta de verificación de un microservicio del monorepo (typecheck, lint, tests con cobertura, build y, opcional, tests de integración contra un Postgres temporal). Usar SIEMPRE antes de dar por terminado un cambio de código, antes de un commit/PR, y cuando el usuario pida "correr los tests", "verificar", "dejar todo en verde" o "ver si compila".
---

# verify — "terminado" siempre significa lo mismo

Un cambio no está terminado hasta que esta compuerta está **verde**. No se reporta "listo" sin haberla corrido.

## Cómo correrla

```bash
# completa (typecheck → lint → test:cov → build)
node .claude/skills/verify/scripts/verify.js chatia-backend

# + integración contra un Postgres temporal (migrate deploy incluido)
node .claude/skills/verify/scripts/verify.js chatia-backend --integration

# solo lo rápido mientras se itera (typecheck + lint)
node .claude/skills/verify/scripts/verify.js chatia-backend --fast
```

El script sale con código 1 si algún paso falla y muestra las últimas 30 líneas del paso que falló.
Pasos sin script en `package.json` se marcan `N/A` (no se ocultan).

## Reglas
1. **Reportar el resultado tal cual**: si algo falla, decir cuál paso y por qué. Nunca "debería andar".
2. **Cambios de estructura, módulos, repositories, colas o migraciones → usar `--integration`.**
3. Si cambiaste `schema.prisma`, correr además `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
   (el CI lo hace; la base local sin pgvector puede mostrar `KbChunk.embeddingVec` como diferencia esperada).
4. No bajar umbrales de cobertura ni silenciar lint para ponerlo en verde. Si hay que subir el umbral porque la cobertura mejoró, hacerlo en `jest.config.ts`.
5. `pnpm lint` (con `--fix`) reescribe archivos; para verificar se usa `lint:check`, que es lo que corre el script.

## Postgres temporal (solo para integración)
`scripts/pg-temp.js` arranca un Postgres en el puerto 54329 con datos en el directorio temporal del sistema.
Busca los binarios en `PG_BIN`, en `C:\Program Files\PostgreSQL\<versión>\bin` o en el PATH.

```bash
node .claude/skills/verify/scripts/pg-temp.js start mi_db   # imprime la URL
node .claude/skills/verify/scripts/pg-temp.js stop
node .claude/skills/verify/scripts/pg-temp.js clean         # detiene y borra los datos
```

**Nunca** apuntar `TEST_DATABASE_URL` a la base del `.env` (es la de Railway): los tests crean y borran filas.

## Qué NO prueba esta compuerta (decirlo al reportar)
- Redis/BullMQ reales, la imagen Docker ni un despliegue: para eso está el skill `deploy-railway`.
- Seguridad: para eso está `security-review-tenant`.
