# Capas por Microservicio — Arquitectura 10/10

> Reestructurado 2026-10-02; `src/` con solo tres carpetas desde 2026-10-15 (ADR-022). **chatia-backend ya lo cumple;
> los otros 5 servicios están pendientes** (ver `roadmap/deuda-tecnica.md`).

## Estructura canónica

```
{servicio}-backend/src/        ← SOLO tres carpetas + main.ts, app.module.ts y generated/ (Prisma)

├── core/                          ← dominio — CERO controllers, CERO @Controller, no importa de modules/
│   ├── {bounded-context}/
│   │   ├── domain/                ← entidades, errores de dominio
│   │   ├── repository/            ← interfaces (las implementaciones Prisma van en infrastructure/)
│   │   ├── types/
│   │   ├── schemas.ts             ← Zod (los services usan sus tipos; el controller los importa)
│   │   ├── {context}.service.ts
│   │   ├── {context}.module.ts
│   │   └── index.ts               ← contrato público
│   └── index.ts
│
├── modules/                       ← ÚNICO lugar con controllers HTTP de negocio
│   ├── common/                    ← API común a todos los ecosistemas: /api/v1/...  (CommonApiModule)
│   │   └── {dominio}/{dominio}.controller.ts
│   ├── welver/                    ← strategy + config + tipos + endpoints EXCLUSIVOS (/api/welver/v1/...)
│   ├── manzana/  (mismo molde)
│   ├── mexus/    (mismo molde)
│   └── index.ts                   ← {Servicio}ModulesModule — agrupa common + ecosistemas
│
└── infrastructure/                ← todo lo que no es dominio ni API de negocio
    ├── prisma/  firebase/  groq/  providers/  langgraph/   ← clientes y adaptadores externos
    ├── security/  common/  config/  types/                 ← guards, pipes, filters, cifrado, env
    ├── channels/                  ← WhatsApp / Instagram / Messenger / TikTok + adapters multimodales
    ├── events/                    ← WebSocket
    ├── queue/                     ← processors BullMQ, constantes, DLQ
    ├── transport/                 ← grpc/, health/, internal/ (adaptadores de transporte, sin dominio)
    ├── maintenance/               ← CLI operativa
    └── testing/                   ← fixtures, stubs, tests de integración y de arquitectura
```

**Dónde va cada cosa (para no dudar):**

| Si es… | Va en |
|---|---|
| Regla de negocio, entidad, servicio de dominio, lógica de retención/privacidad | `core/<contexto>/` |
| Endpoint igual para todos los ecosistemas (incluye webhooks, widget, channel-accounts…) | controller en `modules/common/<dominio>/`, lógica en `core/<dominio>/` |
| Endpoint que existe solo en un ecosistema | `modules/<eco>/` bajo `/api/<eco>/v1/...` |
| Comportamiento distinto por ecosistema (prompt, tono, flags, límites) | `modules/<eco>/` strategy + config — nunca `if (eco === …)` en controllers |
| Cliente de un proveedor externo, repositorio Prisma, cola, WebSocket, gRPC, health | `infrastructure/` |
| Algo que no encaja | se discute y se registra en un ADR; no se crea una carpeta nueva en `src/` |

> `architecture.spec.ts` (en `infrastructure/testing/`) hace cumplir: raíz de `src/` limpia, `core/` sin controllers y sin
> importar de `modules/`, ecosistemas aislados entre sí, `common` sin importar de ecosistemas.

### `modules/common/` (ADR-022)

Los endpoints cuyo contrato es el mismo para todos los ecosistemas (`/api/v1/contacts`, `/conversations`, `/assistant`…)
viven en `modules/common/<dominio>/<dominio>.controller.ts` y se agrupan en `CommonApiModule`. El ecosistema se
resuelve por el token (TenantGuard), no por la URL. Lo que cambia entre ecosistemas se expresa en su strategy/config
(`modules/<eco>/`). Un endpoint que solo existe en un ecosistema va en `modules/<eco>/` bajo `/api/<eco>/v1/...`.
`modules/common` no importa de ningún ecosistema y los ecosistemas no se importan entre sí.

## La regla más importante

> `core/` nunca tiene `@Controller`. `modules/` solo tiene controllers por ecosistema.
> `infrastructure/` nunca tiene lógica de negocio.

## Reglas por zona

### `core/`
- Servicios, repositorios (solo interfaces), entidades, procesadores de dominio
- CERO `@Controller`, CERO rutas HTTP, CERO `@GrpcMethod`
- No sabe que existe HTTP, gRPC ni BullMQ
- Solo conoce interfaces, tipos y lógica de negocio pura
- Cada bounded context tiene su `index.ts` que define qué es público
- Si aparece un `@Controller` en `core/` → bug de arquitectura

### `modules/`
- ÚNICO lugar con controllers HTTP de negocio
- Cada ecosistema tiene su carpeta: `welver/`, `manzana/`, `mexus/`
- `modules/index.ts` exporta `{Servicio}ModulesModule` que agrupa los tres
- `app.module.ts` importa solo ese módulo — agregar un ecosistema nuevo no toca `app.module.ts`
- Agregar un ecosistema = crear carpeta en `modules/` + agregar al `index.ts`

### `infrastructure/`
- Todo lo que no tiene lógica de negocio
- Las implementaciones concretas de repositorios (Prisma) viven aquí, no en `core/`
- Binding de DI: `{ provide: TOKEN, useClass: PrismaImpl }` vive en el módulo de infrastructure
- Circuit breakers, adapters de plataformas externas, clientes HTTP — todos aquí

### Entry points transversales (sin carpeta propia en `src/`)

Ya no hay excepciones en la raíz de `src/` (ADR-022). Lo que antes eran carpetas sueltas:

| Antes | Ahora |
|---|---|
| `webhooks/`, `widget/`, `channel-accounts/`, `agent-notifications/` | controller en `modules/common/<x>/`, lógica en `core/<x>/` |
| `queue/` (processors, DLQ) | `infrastructure/queue/` (la lógica queda en services de `core/`) |
| `health/`, `internal/`, `grpc/` | `infrastructure/transport/{health,internal,grpc}/` |
| `channels/`, `events/`, `maintenance/` | `infrastructure/{channels,events,maintenance}/` |
| `privacy/` | `core/privacy/` |
| `test/`, specs sueltos | `infrastructure/testing/` |
| `ad-accounts/` (marketing) | `modules/common/ad-accounts/` + lógica en `core/` |

La pregunta que decide dónde va un endpoint:
> ¿El endpoint varía por ecosistema o tiene lógica distinta por cliente?
> Si sí → `modules/{eco}/`. Si no → `modules/common/`.

## Reglas por capa

### Controller (HTTP en `modules/`)
- Solo recibe, valida con Zod, llama al service del core, retorna
- No contiene lógica condicional de negocio
- Importa ÚNICAMENTE del `core/` vía `index.ts` — nunca internals

### Controller (gRPC en `grpc/`)
- Solo expone métodos definidos en el `.proto`
- Delega al service del core — CERO lógica de negocio

### Service (en `core/`)
- Lógica de dominio, validaciones de negocio, orquestación
- Inyecta repositorios por interface (`@Inject(TOKEN)`) — nunca PrismaService directamente

### Processor (BullMQ en `queue/`)
- Extiende `WorkerHost`, decora con `@Processor(QUEUE_NAME)`
- Idempotente — el mismo job N veces produce el mismo resultado
- Puede consumir del `core/` vía sus services
