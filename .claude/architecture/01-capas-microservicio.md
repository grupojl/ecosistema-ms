# Capas por Microservicio — Arquitectura 10/10

> Reestructurado 2026-10-02. Todos los servicios siguen este modelo.

## Estructura canónica

```
{servicio}-backend/src/

├── core/                          ← dominio puro — CERO controllers, CERO @Controller
│   ├── {bounded-context}/
│   │   ├── domain/                ← entidades, errores de dominio
│   │   ├── repository/            ← interfaces (nunca implementaciones Prisma)
│   │   ├── types/
│   │   ├── {context}.service.ts
│   │   ├── {context}.module.ts
│   │   └── index.ts               ← contrato público — lo que los modules pueden consumir
│   └── index.ts
│
├── modules/                       ← ÚNICO lugar con controllers HTTP por ecosistema
│   ├── welver/
│   │   ├── welver.controller.ts   ← endpoints específicos de welver
│   │   ├── welver.module.ts
│   │   ├── schemas.ts             ← Zod schemas del controller
│   │   └── index.ts
│   ├── manzana/  (mismo molde)
│   ├── mexus/    (mismo molde)
│   └── index.ts                   ← {Servicio}ModulesModule — agrupa los tres
│
├── infrastructure/                ← todo sin lógica de negocio
│   ├── prisma/                    ← PrismaService, PrismaModule
│   ├── firebase/                  ← FirebaseModule, FirebaseService
│   ├── common/                    ← guards, decorators, pipes, filters, middleware
│   ├── config/                    ← validación de env vars
│   └── types/                     ← declaraciones .d.ts
│
├── queue/                         ← processors BullMQ + constants + module
│   ├── processors/
│   └── queue.constants.ts
│
├── {entry-point}/                 ← excepción transversal justificada
│   ├── {entry-point}.controller.ts
│   └── {entry-point}.module.ts
│
├── grpc/                          ← puerto interno inter-servicio
├── health/                        ← Railway healthcheck
├── internal/                      ← superadmin (x-internal-api-key)
├── app.module.ts                  ← importa {Servicio}ModulesModule (1 import de negocio)
└── main.ts
```

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

### Excepciones transversales justificadas
Tienen controller pero viven fuera de `modules/` porque son iguales para todos los ecosistemas:

| Carpeta | Justificación |
|---|---|
| `webhooks/` | Entry point de canales externos — igual para todos |
| `widget/` | Chat público embeddable — sin auth, sin tenant |
| `channel-accounts/` | Gestión de cuentas de canal — igual para todos |
| `agent-notifications/` | Alertas in-app para agentes — igual para todos |
| `queue/dlq/` | Inspección y retry de jobs — operacional |
| `health/` | Railway healthcheck |
| `internal/` | Superadmin protegido por x-internal-api-key |
| `grpc/` | Puerto interno inter-servicio — no es HTTP público |
| `ad-accounts/` | OAuth de plataformas — marketing-backend |

La pregunta que decide si algo es excepción:
> ¿El endpoint varía por ecosistema o tiene lógica distinta por cliente?
> Si sí → `modules/{eco}/`. Si no → excepción al mismo nivel con justificación.

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
