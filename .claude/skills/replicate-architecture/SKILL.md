---
name: replicate-architecture
description: Migrar un microservicio del monorepo a la estructura ADR-022 (src/ con solo core, infrastructure y modules; controllers en modules/common; repositories Prisma en infrastructure). Usar cuando el usuario pida "aplicar la estructura de chatia a <servicio>", "reestructurar analytics/pasarelapagos/notificaciones/workers/marketing" o "replicar la arquitectura".
---

# replicate-architecture

**Estado (2026-10-15):** solo `chatia-backend` cumple ADR-022. Pendientes: `analytics`, `pasarelapagos`, `notificaciones`, `workers`, `marketing`.
**Uno por vez.** Cada servicio termina en verde (`verify`) antes de empezar el siguiente.

## Antes
1. `node .claude/skills/audit-service/scripts/metrics.js <svc>` → guardar la foto "antes" (carpetas extra, controllers en core, Prisma en core).
2. Asegurar punto de retorno: rama o commit limpio (la herramienta usa `git mv`, así que el historial se conserva).
3. Leer la estructura real: `ls <svc>/src` y decidir el mapa de carpetas. **El mapa es por servicio.**

## Mapa tipo (de chatia; adaptar)
| Carpeta suelta | Destino |
|---|---|
| controller de un entry point (webhooks, widget, ad-accounts…) | `modules/common/<x>/` (la lógica queda en `core/<x>/`) |
| `queue/`, `channels/`, `events/`, `maintenance/`, `common/`, `config/`, `prisma/`, `sse/` | `infrastructure/<x>/` |
| `health/`, `internal/`, `grpc/` | `infrastructure/transport/<x>/` |
| dominio suelto (`campaigns/`, `jobs/`, `tenants/`, `notifications/`…) | `core/<x>/` (con sus controllers a `modules/common/`) |
| `test/` y specs sueltos de la raíz | `infrastructure/testing/` |
| `generated/` (cliente Prisma) | se queda: es salida de herramienta (ADR-020) |

## Ejecución
1. Copiar los mapas `DIRS` y `CONTROLLER_DIRS` de `.claude/tools/restructure-src.js` y adaptarlos a este servicio.
   Probar primero: `node .claude/tools/restructure-src.js <svc> --dry`.
2. Correr sin `--dry`. Mueve con `git mv` y reescribe todos los imports `@/...`.
3. **Pasos manuales posteriores** (la herramienta no los hace):
   - Quitar `controllers: [...]` de los módulos que quedaron en `core/` y registrar esos controllers en un `CommonApiModule` (`modules/common/common-api.module.ts`), importado por `modules/index.ts`.
   - Ajustar `package.json` (scripts que apuntan a `dist/<carpeta>/…`), `jest.config.ts` (`rootDir`, stubs, `collectCoverageFrom`), `eslint.config.mjs`.
   - Corregir tests que usan `__dirname` (boot, integración, migraciones).
   - Mover las implementaciones Prisma de repositories a `infrastructure/prisma/repositories/` y su binding a `prisma.module.ts`.
   - Copiar `infrastructure/testing/architecture.spec.ts` de chatia; adaptar las listas `PRISMA_DEBT` e `INFRA_DEBT` a la deuda **real** de este servicio (el test falla si la lista tiene archivos que ya no cumplen, y si aparece uno nuevo).
4. Skill `verify --integration` hasta verde.
5. Skill `docs-sync --service <svc>`: corregir los `.md` que citan rutas viejas (la herramienta no toca documentación).
6. Skill `audit-service`: foto "después" y delta.

## Cierre
- Actualizar `architecture/01-capas-microservicio.md` (quitar este servicio de "pendientes"), `services/<svc>.md`, `roadmap/deuda-tecnica.md` y la línea de `CLAUDE.md`.
- No mezclar la mudanza con cambios funcionales en el mismo commit.

## Trampas conocidas (ya nos pasaron)
- Un `@Controller` movido a `modules/` seguía declarado en su módulo de `core/` → `core` importando de `modules`. El `architecture.spec.ts` lo detecta.
- Servicios globales (`@Global`) y tokens de DI: al mover los bindings, revisar que el boot test (`app.boot.spec.ts`) resuelva todo.
- Regex en scripts con shell: escribir los archivos con el editor, no con heredocs (se pierden las barras `\`).
