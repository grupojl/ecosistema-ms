# ADR-023 — Row Level Security (RLS) como segunda barrera de aislamiento entre tenants: evaluación

**Fecha:** 2026-10-15 · **Estado:** Propuesto — **no se implementa ahora**; queda un piloto condicionado a DT-015

## Contexto
Hoy el aislamiento entre organizaciones/ecosistemas depende de que **cada consulta** lleve el filtro de tenant en el
`where` (barrera única, en la aplicación). Lo respaldan: repositorios que reciben `organizationId`/`ecosystemId`
(`scope()`), tests de dos tenants contra Postgres real (`repositories.integration.spec.ts`, `chatia.integration.spec.ts`,
`attack-surface.integration.spec.ts`) y el escáner `security-review-tenant` (0 hallazgos ALTA/MEDIA).
El riesgo que RLS cubriría: **una consulta nueva que olvide el filtro** (error humano) deja de ser una fuga y pasa a ser un
resultado vacío o un error.

Hechos del código que condicionan la decisión (verificados el 2026-10-15):
- Prisma 7 con `@prisma/adapter-pg` y un `pg.Pool` (`PrismaService`): las consultas toman una conexión cualquiera del pool;
  la variable de sesión de RLS (`SET LOCAL app.organization_id`) solo vale dentro de **la misma transacción**.
- **No todas las tablas tienen `organizationId`**: `Message` solo cuelga de `Conversation`; `Conversation` cuelga de
  `ChannelAccount`/`Contact` (DT-015); `KbChunk` cuelga de `KbDocument`. Una política sobre ellas necesita un `JOIN`/subconsulta
  por fila (costoso) o denormalizar la columna.
- Trabajos sin usuario (jobs de BullMQ, webhooks, retención de datos, CLI de mantenimiento) operan sobre **varios** tenants
  o antes de conocerlo: necesitan un rol que ignore RLS o fijar el tenant por job.
- Los tests de integración y el CI usan el superusuario `postgres`, que **ignora RLS** salvo `FORCE ROW LEVEL SECURITY` y un
  rol no propietario.
- Railway entrega un único usuario de base de datos; habría que crear y rotar un segundo rol.

## Decisión
1. **No adoptar RLS hoy.** El costo (reescribir el acceso a datos a transacciones por request, denormalizar tablas, doble
   rol, migraciones de políticas) supera el riesgo residual mientras haya cobertura de dos tenants y escáner en CI.
2. **Prerrequisito para reconsiderarlo:** cerrar DT-015 (denormalizar `organizationId` en `Conversation` y `Message`).
3. **Piloto posible** (cuando se cierre DT-015): `Contact`, `Conversation` y `Message`, con rol de aplicación sin privilegios,
   `FORCE ROW LEVEL SECURITY`, y una extensión de Prisma que abra una transacción con
   `select set_config('app.organization_id', $1, true)` por request. Medir sobrecarga (p95) antes de extender a más tablas.
4. **Mientras tanto, refuerzo barato y ya hecho:** el escáner entiende filtros armados en variables (`where`/`scope`),
   los tests de dos tenants cubren cada repositorio y hay pruebas de ataque por HTTP sobre webhooks y widget.

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| RLS en todas las tablas ya | Hay tablas sin `organizationId`; sin denormalizar, cada política sería un JOIN por fila. Sin rol no-superusuario no protege nada en tests |
| Un esquema o base de datos por tenant | Migraciones × N tenants y conexiones por tenant; desproporcionado para el volumen actual |
| Solo confiar en el `where` de aplicación (estado actual) | Es la barrera única: un olvido es una fuga. Se acepta temporalmente con las mitigaciones del punto 4 |
| Middleware/extensión de Prisma que inyecte `organizationId` automáticamente | Menos invasivo que RLS pero no cubre SQL crudo ni consultas por relación (`conversation.channelAccount.organizationId`) |

## Consecuencias

**Ganancia (de hacerlo en el piloto):** un `where` olvidado no filtra datos de otro tenant; defensa en profundidad real.

**Costo / deuda técnica consciente:**
- Hoy el aislamiento sigue siendo de una sola capa. Se acepta con el escáner + tests de dos tenants + pruebas de ataque.
- Cada repositorio nuevo debe seguir la regla dura: **todo `findMany/count/updateMany/deleteMany` lleva tenant (o una clave
  que ya cuelga de uno)** y trae su caso de dos tenants en `repositories.integration.spec.ts`.

**Regla permanente que queda:**
- Un repositorio nuevo no entra a `main` sin (a) el filtro de tenant, (b) una prueba con dos tenants contra Postgres real y
  (c) `scan.js` sin MEDIA nuevas.

## Referencias
- `chatia-backend/src/infrastructure/prisma/prisma.service.ts`, `chatia-backend/prisma/schema.prisma`
- `.claude/skills/security-review-tenant/scripts/scan.js`
- `chatia-backend/src/infrastructure/testing/integration/` (repositories, attack-surface)
- `.claude/AUDIT-LAST.md` (pendientes) — DT-015: Conversation sin organizationId directo
- ADR-022 (estructura de capas)
