---
name: new-module
description: Crear un bounded context nuevo (o un endpoint nuevo) en un microservicio con la estructura ADR-022 — dominio, interface de repository, implementación Prisma en infrastructure, service, controller en modules/common, specs y registro. Usar cuando el usuario pida "agregar un módulo/recurso/endpoint", "crear el CRUD de X" o "nuevo dominio" en chatia-backend (o en otro servicio ya migrado a ADR-022).
---

# new-module — un contexto nuevo nace sin deuda

Modelos a copiar (ya cumplen la regla): **`core/contacts`**, **`core/conversations`** y **`core/agents`** en `chatia-backend`.
Estructura y reglas: `.claude/architecture/01-capas-microservicio.md`, `decisions/ADR-022-api-comun-en-modules-common.md`.

## Antes de escribir
1. ¿Existe ya el dominio en otro módulo? Buscar antes de crear.
2. ¿El endpoint es **común** a todos los ecosistemas o **exclusivo** de uno? (ver tabla en `01-capas-microservicio.md`)
   Común → `modules/common/<dominio>/`. Exclusivo → `modules/<eco>/` bajo `/api/<eco>/v1/...`.
3. Definir contratos de entrada/salida (Zod + tipos) y las **invariantes** de dominio antes del código.

## Archivos (en este orden)
| # | Archivo | Contenido |
|---|---|---|
| 1 | `core/<x>/domain/<x>.entity.ts` | Tipos y reglas puras (`assert*`). Sin NestJS ni Prisma |
| 2 | `core/<x>/domain/<x>.errors.ts` | Errores de dominio tipados |
| 3 | `core/<x>/repository/<x>.repository.interface.ts` | `export const X_REPOSITORY = Symbol(...)` + interface. **Toda consulta lleva `organizationId`** |
| 4 | `core/<x>/schemas.ts` | Zod (los services usan sus tipos; el controller los importa) |
| 5 | `core/<x>/<x>.service.ts` | Lógica. Inyecta `@Inject(X_REPOSITORY)`; **nunca** `PrismaService`. Traduce errores de dominio a `HttpException` |
| 6 | `core/<x>/<x>.module.ts` | Solo providers/exports del service. Sin `controllers:` |
| 7 | `core/<x>/index.ts` | Contrato público |
| 8 | `infrastructure/prisma/repositories/prisma-<x>.repository.ts` | Único archivo que conoce Prisma, con `toEntity()` |
| 9 | `infrastructure/prisma/prisma.module.ts` | Agregar `{ provide: X_REPOSITORY, useClass: PrismaXRepository }` |
| 10 | `modules/common/<x>/<x>.controller.ts` | `@UseGuards(TenantGuard)`, `ZodValidationPipe`, delega al service. Sin lógica ni Prisma |
| 11 | `modules/common/common-api.module.ts` | Registrar el controller e importar el módulo de `core/` |

## Specs (obligatorios)
- `domain`: reglas puras (casos permitido/denegado).
- `service`: repository mockeado; cada rama de error; **un actor de otra organización recibe 403/404**.
- `infrastructure/testing/integration/<x>.integration.spec.ts`: contra Postgres real — aislamiento entre dos tenants, restricciones únicas, upserts que no mueven de organización.

## Cierre
1. Skill `verify --integration` en verde (incluye `architecture.spec.ts`, que falla si hay un `@Controller` en `core/` o un `PrismaService` nuevo en `core/`).
2. Skill `security-review-tenant` sin ALTA.
3. Si el recurso es nuevo para los frontends, anotarlo en `contracts/` y en `services/<svc>.md`.

## Prohibido
- `PrismaService` en un service de `core/` (el trinquete de `architecture.spec.ts` lo bloquea).
- `@Controller` en `core/`.
- Imports relativos (`../`) — siempre `@/…js`.
- `any`, `eslint-disable`, `@prisma/client` (usar `@/generated/prisma/client.js`).
- Identidad (`organizationId`, `firebaseUid`) tomada del body.
