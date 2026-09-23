# 12 — Patrón ProjectStrategy: personalización por ecosistema sin acoplar el core

> Referentes: **Salesforce** (multi-tenancy con Custom Fields tipados) ·
> **Shopify** (extensibilidad desacoplada del ciclo de deploy)
>
> Decisión formal: `decisions/ADR-019-project-strategy-multi-servicio.md`

---

## El principio

> El core de un microservicio nunca debe conocer qué ecosistema lo está
> llamando. Solo conoce un contrato (`ProjectStrategy`); quién lo implementa
> es responsabilidad de `modules/{ecosistema}/`.

Esto es lo mismo que dice `architecture/00-principios.md` para la frontera
entre microservicios, aplicado ahora a la frontera entre el core de un
microservicio y sus ecosistemas cliente.

---

## Cuándo aplica este patrón

Antes de agregar `core/strategies/` a un microservicio nuevo, responder:

**¿El comportamiento de negocio cambia por ecosistema, o solo cambian los
datos que se leen/escriben?**

- Solo datos → alcanza con `ecosystemId` + `organizationId` en el `where`
  (ver `architecture/00-principios.md`, regla de multi-tenant)
- Comportamiento (routing, reglas, side-effects, contenido de templates,
  umbrales de negocio) → aplica Strategy

| Microservicio | ¿Strategy? | Motivo |
|---|---|---|
| chatia-backend | ✅ implementado | prompt, tono, reglas de escalación por ecosistema |
| pasarelapagos-backend | ✅ implementado | routing de providers, métodos de pago habilitados |
| notificaciones-backend | ✅ implementado | templates, canales preferidos, horarios |
| marketing-backend | 🔲 candidato futuro | reglas de automatización por ecosistema — fuera de scope actual |
| analytics-backend | ❌ no aplica | es dimensión de datos, no comportamiento |
| workers-backend | ❌ no aplica hoy | procesamiento no difiere por ecosistema todavía |

---

## Estructura canónica

```
{servicio}-backend/src/
  core/strategies/
    project-context.interface.ts   # shape del contexto enriquecido
    project-strategy.interface.ts  # contrato que cada ecosistema implementa
    project-strategy.registry.ts   # resuelve estrategia en runtime
    generic.strategy.ts            # fallback — nunca falla
    project-strategy.module.ts     # exporta el registry
  modules/
    welver/
      welver.config.ts             # flags, overrides default
      welver.strategy.ts           # implementa ProjectStrategy
      welver.module.ts             # se auto-registra en onModuleInit
      types/context.ts             # TODO: tipar businessData
    manzana/  (mismo molde)
    mexus/    (mismo molde)
```

## Contrato `ProjectStrategy`

Dos hooks, nombrados según el dominio del microservicio (no genéricos —
`enrichPaymentContext`/`afterChargeResult` en pagos, no
`enrichContext`/`afterResponse` copiado literal de chatia). La razón:
si el método se llama igual en los 6 microservicios pero hace cosas
distintas, se pierde legibilidad al leer una estrategia concreta.

```ts
interface ProjectStrategy {
  // Se llama ANTES de la operación de negocio.
  // Si falla: loguea y devuelve contexto vacío. NUNCA lanza.
  enrichXContext(ecosystemId, organizationId, input): Promise<ProjectContext>;

  // Se llama DESPUÉS de la operación.
  // Si falla: solo loguea. NUNCA lanza.
  afterXResult(result, context): Promise<void>;

  getProjectType(): ProjectType;
}
```

## Regla dura: los hooks nunca lanzan

Un bug en la estrategia de un ecosistema no puede romper el flujo de los
demás. Si `enrichXContext` o `afterXResult` fallan, capturan el error,
loguean y devuelven un valor neutro (contexto vacío / no-op). Esto es
lo mismo que ya aplica `04-degradacion-elegante.md` para integraciones
externas — un fallo de personalización es una integración más.

## Registry con fallback obligatorio

```ts
get(type: ProjectType): ProjectStrategy {
  const strategy = this.strategies.get(type);
  if (!strategy) {
    // warning, nunca throw — GenericStrategy responde con comportamiento default
    return this.strategies.get(ProjectType.GENERIC)!;
  }
  return strategy;
}
```

Un ecosistema mal configurado (o uno nuevo sin estrategia todavía) nunca
tira el microservicio — cae a comportamiento genérico.

---

## Deuda consciente: `businessData` sin tipar

`ProjectContext.businessData` es `Record<string, unknown>` en las tres
implementaciones actuales. Es aceptable en el arranque (3 ecosistemas,
estrategias todavía placeholder). **No es aceptable pasado ese punto.**

Salesforce fuerza Custom Fields tipados por organización — nosotros debemos
tipar `businessData` por ecosistema apenas la primera estrategia tenga
lógica real:

```ts
// ❌ hoy
businessData: Record<string, unknown>;

// ✅ objetivo, cuando welver tenga lógica real en pasarelapagos-backend
interface WelverPaymentBusinessData {
  preferredProvider: 'mercadopago' | 'stripe';
  maxInstallments: number;
}
```

Ver `roadmap/deuda-tecnica.md` para el ticket concreto.

---

## Evolución futura: cuándo desacoplar del ciclo de deploy

Hoy agregar un ecosistema implica agregar `modules/{eco}/` y redeployar.
Aceptable con 3 ecosistemas. Si algún ecosistema necesita iterar su lógica
sin esperar el pipeline de CI del ecosistema-ms, la migración (inspirada en
Shopify Functions) es sacar `modules/{eco}/` a un servicio invocado por
HTTP/evento — la interface `ProjectStrategy` no cambia, solo el transporte
detrás de la implementación concreta. No se hace preventivamente: es deuda
técnica aceptar el redeploy hasta que haya una necesidad real.

## Checklist antes de escribir una estrategia nueva

1. ¿Ya evalué que es comportamiento y no solo datos? (ver tabla arriba)
2. ¿Los dos hooks están envueltos en try/catch que nunca relanza?
3. ¿`GenericStrategy` sigue siendo el fallback si el registry no encuentra el tipo?
4. ¿El nombre de los hooks tiene sentido en el dominio del microservicio,
   no es un copy-paste literal de chatia?
5. ¿`businessData` tiene un tipo definido en `types/context.ts`, o sigue
   como `unknown` a sabiendas de que es deuda?
