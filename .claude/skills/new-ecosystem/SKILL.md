---
name: new-ecosystem
description: Agregar un ecosistema nuevo (como Welver, Manzana o Mexus) a un servicio — carpeta en modules/ con strategy, config, tipos de negocio, registro, archivo de dominio y los pendientes que debe completar producto. Usar cuando el usuario pida "sumar un ecosistema", "crear el módulo de <nombre>" o completar el comportamiento de Manzana/Mexus.
---

# new-ecosystem

Un ecosistema **no tiene sus propios controllers comunes**: usa la API común (`modules/common`, `/api/v1/...`) y se diferencia por
**strategy + config + flags/límites de la organización** (ver `architecture/12-project-strategy-pattern.md`, ADR-019).
Solo si existe un endpoint que los otros no tienen, va en `modules/<eco>/` bajo `/api/<eco>/v1/...`.

Molde a copiar: `chatia-backend/src/modules/welver/` (único ecosistema con dominio definido).

## Procedimiento
1. **Dominio primero (producto):** crear `.claude/domain/<eco>.md` con la estructura de `domain/README.md`
   (qué es · usuario final · tenant · flujo · reglas de negocio · invariantes · KPIs). Sin esto **no se escribe el prompt ni la strategy**:
   `manzana.md` y `mexus.md` hoy son placeholders con `TODO`.
2. **Copiar el molde** `modules/welver/` → `modules/<eco>/` y renombrar:
   - `<eco>.strategy.ts` — implementa `ProjectStrategy`, se registra en `onModuleInit` (nunca lanza en `enrich/after`)
   - `<eco>.config.ts` — prompt base y parámetros (`build<Eco>SystemPrompt`)
   - `types/context.ts` — `businessData` tipado del ecosistema
   - `schemas.ts`, `<eco>.module.ts`, `index.ts`
3. **Registrar el tipo**: agregar el valor a `ProjectType` (`core/strategies/project-strategy.interface.ts`) y el módulo a `modules/index.ts`.
   `app.module.ts` **no se toca**.
4. **Dar de alta el ecosistema** (datos): `POST /api/v1/ecosystems` con la clave de plataforma (registra `firebaseProjectId`).
5. **Configurar la organización**: `ChatFeatureFlags` y `ChatLimits` por organización (`organization-config`), no condicionales en código.
6. **Tests**: strategy (prompt incluye los datos del negocio; nunca lanza ante datos faltantes) + que el ecosistema no importe de otro.
   `infrastructure/testing/architecture.spec.ts` ya valida el aislamiento entre ecosistemas.
7. Actualizar `.claude/domain/README.md` (tabla de ecosistemas) y `services/<svc>.md`.

## Reglas
- Un ecosistema **no importa** de otro ni de `modules/common`.
- Nada de `if (ecosystemId === 'x')` en controllers o services de `core/`: la variación vive en la strategy.
- Cambiar el comportamiento de producto de un ecosistema exige actualizar su archivo de dominio **en el mismo commit**.
- Si el ecosistema necesita el mismo endpoint que otro pero con otra regla, es un **matiz de strategy**, no un controller nuevo.

## Pendiente de producto (hoy)
- `manzana.md` y `mexus.md`: completar el dominio antes del primer despliegue de esos ecosistemas.
- Sus strategies tienen un prompt genérico con `TODO`.
