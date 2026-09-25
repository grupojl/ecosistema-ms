# ADR-019 — Replicar ProjectStrategy en pasarelapagos-backend y notificaciones-backend

**Fecha:** 2026-09-23
**Estado:** Aceptado — scaffold generado, wiring manual pendiente
**Repo:** grupojl/ecosistema-ms

## Contexto

`chatia-backend` tiene el patrón `ProjectStrategy` / `ProjectStrategyRegistry`
(`src/core/strategies/`) que permite que cada ecosistema (welver, manzana,
mexus) personalice comportamiento del core sin que el core conozca al
ecosistema concreto. El core solo depende de la interface `ProjectStrategy`;
el registry resuelve en runtime cuál usar, con `GenericStrategy` como
fallback seguro si no hay estrategia registrada.

Los otros 5 microservicios resuelven multi-tenancy solo con
`ecosystemId` + `organizationId` como filtro de query — eso es aislamiento
de **datos**, no personalización de **comportamiento**. Si welver necesita
un flujo de pago distinto a manzana (otro provider preferido, otra regla
de routing), hoy no hay dónde poner esa lógica sin `if (ecosystemId === X)`
esparcido en el service.

## Decisión

Replicar el patrón `ProjectStrategy` en los microservicios donde el
**comportamiento** (no solo los datos) difiere por ecosistema:

- `pasarelapagos-backend` — routing de providers, métodos de pago habilitados
- `notificaciones-backend` — templates, canales preferidos, horarios de envío

**No se replica (todavía) en:**

- `analytics-backend` — es dimensión de datos (`ecosystemId` en el where),
  no comportamiento. Agregar Strategy ahí hoy sería abstracción sin uso.
- `workers-backend` — los jobs ya reciben `ecosystemId` en el payload; el
  *procesamiento* no difiere por ecosistema todavía.
- `marketing-backend` — candidato futuro (reglas de automatización por
  ecosistema) pero fuera de scope de esta iteración.

Criterio para decidir si un microservicio nuevo necesita el patrón:

> ¿El *comportamiento* de negocio cambia por ecosistema, o solo cambian
> los *datos* que se leen/escriben? Si es solo datos, un filtro
> `ecosystemId` en el where alcanza. Si es comportamiento, Strategy.

## Referentes de industria

### Salesforce — multi-tenancy real con personalización tipada

Salesforce corre miles de organizaciones sobre el mismo core; cada una
personaliza comportamiento via Apex Triggers y Custom Metadata sin forkear
el motor. El paralelismo es directo:

| Nuestro patrón | Salesforce |
|---|---|
| `ProjectStrategy` interface | Trigger framework |
| `ProjectStrategyRegistry.get(type)` | Runtime resuelve Apex según Org ID |
| `GenericStrategy` fallback | Comportamiento default sin triggers |
| `businessData: Record<string, unknown>` | Custom Fields / Custom Metadata Types |

Lo que tomamos de Salesforce: **nunca dejar `businessData` como blob sin
tipo**. Ellos fuerzan que cada organización declare sus Custom Fields con
tipo explícito. Ver sección "Deuda consciente" — hoy `businessData` es
`Record<string, unknown>` en los 3 servicios con Strategy; es aceptable en
el arranque, no lo es a 5+ ecosistemas.

### Shopify — extensibilidad desacoplada del ciclo de deploy

Shopify Functions/Apps permiten que un merchant personalice comportamiento
del core sin que el ciclo de release del merchant dependa del ciclo de
release de la plataforma — la personalización corre en un proceso separado
invocado por contrato (webhook/extension point).

Lo que **no** tomamos de Shopify todavía: hoy agregar un ecosistema nuevo
implica agregar una carpeta en `modules/` y redeployar el microservicio.
Es aceptable con 3 ecosistemas. Si algún ecosistema necesita iterar su
lógica de negocio sin esperar nuestro pipeline de CI, la migración natural
es sacar `modules/{eco}/` a un servicio separado que el core invoca por
HTTP/evento — la interface `ProjectStrategy` no cambia, solo el transporte
detrás de la implementación. Esto es exactamente el valor de haber puesto
la interface primero.

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| `if (ecosystemId === 'welver')` inline en el service | No escala más allá de 2 ecosistemas, imposible de testear en aislamiento, mezcla infraestructura con reglas de negocio |
| Config JSON en DB sin código | Sirve para umbrales/flags simples, no para lógica de routing o side-effects — se evaluará como complemento, no reemplazo |
| Microservicio por ecosistema | Multiplica la superficie de deploy y mantenimiento sin necesidad real a este tamaño — el patrón Strategy da el mismo aislamiento de lógica sin el costo operacional |

## Consecuencias

**Ganancia:**
- El core de pagos y notificaciones nunca conoce el ecosistema concreto —
  testeable en aislamiento con `GenericStrategy`
- Agregar un ecosistema nuevo no toca el core, solo agrega `modules/{eco}/`
- Un bug de una estrategia de ecosistema no puede romper el flujo de los
  demás (hooks obligados a no lanzar)

**Costo / deuda técnica consciente:**
- `businessData: Record<string, unknown>` sin tipar en los 3 servicios —
  aceptable ahora, bloqueante a 5+ ecosistemas (ver roadmap/deuda-tecnica.md)
- Wiring de `app.module.ts` es manual — el scaffold no lo automatiza
  porque tocar imports de módulos de forma automática es más riesgoso que
  el ahorro de tiempo que da
- Los 3 `*.strategy.ts` generados son placeholders (`TODO`) — no hay
  lógica real todavía, igual que las estrategias de chatia-backend

**Regla permanente que queda:**
Antes de replicar este patrón en un microservicio nuevo, responder primero
la pregunta del criterio de decisión (comportamiento vs. datos). Si la
respuesta es "solo datos", no se agrega `core/strategies/` — se resuelve
con el filtro `ecosystemId` + `organizationId` estándar del ecosistema-ms.

## Referencias

- `architecture/12-project-strategy-pattern.md` — el patrón documentado
  como referencia técnica permanente
- `chatia-backend/src/core/strategies/` — implementación de referencia
- `roadmap/deuda-tecnica.md` — sección "ProjectStrategy — tipado pendiente"
- `lifecycle/tasks.md` — tasks ejecutables de esta iniciativa

---

## Extensión v2 — org-aware (2026-09-24)

### Problema detectado

La v1 resolvía variación de **comportamiento por ecosistema** pero no por **organización
dentro del ecosistema**. Una org enterprise de Welver tiene los mismos feature flags
que una org starter, lo cual es incorrecto.

### Solución adoptada

Agregar `OrganizationProfile` al `ProjectContext`. Cada strategy resuelve el perfil
de la org via `OrganizationConfigService` (cache Redis TTL 5min → DB → defaults).

```
ecosystemId (ProjectType) → ProjectStrategy
  └─ enrichXContext()
       └─ OrganizationConfigService.resolve(ecosystemId, organizationId)
            ├─ Redis cache TTL 5min
            ├─ DB: OrganizationConfig model (nuevo)
            └─ DEFAULT_ORG_PROFILE (fallback garantizado)
```

### Nuevos archivos por MS

```
{ms}/src/
  core/strategies/
    project-context.interface.ts   ← OrganizationProfile + context tipado por dominio
    project-strategy.interface.ts  ← resolveOrgProfile() nuevo método
    project-strategy.registry.ts   ← sin cambios
    generic.strategy.ts            ← implementa resolveOrgProfile con DEFAULT
    project-strategy.module.ts     ← sin cambios
  organization-config/
    organization-config.repository.interface.ts
    prisma-organization-config.repository.ts
    organization-config.service.ts   ← cache-aside + degradación elegante
    organization-config.module.ts    ← @Global()
  modules/{eco}/
    types/context.ts               ← BusinessData tipado por ecosistema
    {eco}.strategy.ts              ← resolveOrgProfile() delegado a OrgConfigService
    {eco}.module.ts                ← auto-registro en onModuleInit
```

### Invariantes que NO cambian

- Los hooks NUNCA lanzan — degradación elegante garantizada
- GenericStrategy sigue siendo el fallback del registry
- Un bug en welver.strategy.ts no afecta manzana ni mexus

### `businessData` tipado (deuda cerrada parcialmente)

Con esta extensión, cada `modules/{eco}/types/context.ts` define el tipo concreto.
La deuda de `businessData: unknown` → `WELVERBusinessData` está implementada en welver.
Manzana y mexus quedan como placeholder tipado con `[key: string]: unknown` hasta integración.
