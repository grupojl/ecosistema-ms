#!/bin/bash
set -euo pipefail

# =============================================================================
# x.sh — actualiza .claude/ con la decisión de replicar ProjectStrategy
#
# Documenta:
#   1. ADR-019: por qué se replica el patrón, referentes de industria
#      (Salesforce, Shopify) y qué se toma de cada uno
#   2. architecture/12-project-strategy-pattern.md: el patrón en sí,
#      como referencia técnica permanente (mismo nivel que 00-principios.md)
#   3. roadmap/deuda-tecnica.md: deuda de tipado de businessData + pasos
#      manuales pendientes del scaffold
#   4. lifecycle/tasks.md: tasks ejecutables de esta iniciativa
#   5. CLAUDE.md: referencia rápida actualizada
#
# Uso: bash x.sh   (desde la raíz del monorepo, junto a .claude/)
# No toca schema.prisma ni app.module.ts — eso sigue siendo manual.
# =============================================================================

CLAUDE_DIR=".claude"

if [ ! -d "$CLAUDE_DIR" ]; then
  echo "[ERROR] No existe $CLAUDE_DIR — correr desde la raíz del monorepo."
  exit 1
fi

echo "=== Actualizando $CLAUDE_DIR ==="

mkdir -p "$CLAUDE_DIR/decisions"
mkdir -p "$CLAUDE_DIR/architecture"
mkdir -p "$CLAUDE_DIR/roadmap"
mkdir -p "$CLAUDE_DIR/lifecycle"

# ─────────────────────────────────────────────────────────────────────────────
# 1. ADR-019 — decisión + referentes de industria
# ─────────────────────────────────────────────────────────────────────────────
cat > "$CLAUDE_DIR/decisions/ADR-019-project-strategy-multi-servicio.md" <<'EOF'
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
EOF
echo "  [OK] decisions/ADR-019-project-strategy-multi-servicio.md"

# ─────────────────────────────────────────────────────────────────────────────
# 2. architecture/12-project-strategy-pattern.md — referencia técnica permanente
# ─────────────────────────────────────────────────────────────────────────────
cat > "$CLAUDE_DIR/architecture/12-project-strategy-pattern.md" <<'EOF'
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
EOF
echo "  [OK] architecture/12-project-strategy-pattern.md"

# ─────────────────────────────────────────────────────────────────────────────
# 3. roadmap/deuda-tecnica.md — agregar sección (append, no destructivo)
# ─────────────────────────────────────────────────────────────────────────────
DEUDA_FILE="$CLAUDE_DIR/roadmap/deuda-tecnica.md"
touch "$DEUDA_FILE"

if ! grep -q "## ProjectStrategy — tipado pendiente" "$DEUDA_FILE" 2>/dev/null; then
  cat >> "$DEUDA_FILE" <<'EOF'

---

## ProjectStrategy — scaffold + tipado pendiente (ADR-019, 2026-09-23)

### [ECO-PS-01] Wiring manual de app.module.ts — P0
`pasarelapagos-backend` y `notificaciones-backend` tienen `core/strategies/`
y `modules/{welver,manzana,mexus}/` generados, pero **no están importados**
en `app.module.ts` todavía. Sin esto el registry nunca se inicializa.

```ts
// pasarelapagos-backend/src/app.module.ts y notificaciones-backend/src/app.module.ts
import { ProjectStrategyModule } from '@/core/strategies/project-strategy.module';
import { WelverModule }  from '@/modules/welver/welver.module';
import { ManzanaModule } from '@/modules/manzana/manzana.module';
import { MexusModule }   from '@/modules/mexus/mexus.module';
// agregar los 4 al array imports: []
```

### [ECO-PS-02] Estrategias son placeholders vacíos — P1
`{eco}.strategy.ts` en pasarelapagos-backend y notificaciones-backend tienen
`businessData: {}` y comentarios `TODO`. Igual que las estrategias de
chatia-backend — hoy son la estructura correcta esperando contenido real.
Completar cuando cada ecosistema defina su lógica de routing/templates real.

### [ECO-PS-03] `businessData: Record<string, unknown>` sin tipar — P2
Deuda consciente documentada en ADR-019. Aceptable con 3 ecosistemas en
placeholder. Bloqueante apenas la primera estrategia tenga lógica real —
tipar con un shape concreto por ecosistema en `modules/{eco}/types/context.ts`
en vez de dejar `Record<string, unknown>`.

### [ECO-PS-04] Evaluar marketing-backend — P3, no urgente
Candidato a Strategy (reglas de automatización por ecosistema) pero fuera
de scope de esta iteración. No agregar preventivamente — ver criterio de
decisión en `architecture/12-project-strategy-pattern.md`.
EOF
  echo "  [OK] roadmap/deuda-tecnica.md — sección agregada"
else
  echo "  [SKIP] roadmap/deuda-tecnica.md — sección ya existe"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. lifecycle/tasks.md — agregar tasks ejecutables (append, no destructivo)
# ─────────────────────────────────────────────────────────────────────────────
TASKS_FILE="$CLAUDE_DIR/lifecycle/tasks.md"
touch "$TASKS_FILE"

if ! grep -q "## ProjectStrategy multi-servicio — ADR-019" "$TASKS_FILE" 2>/dev/null; then
  cat >> "$TASKS_FILE" <<'EOF'

---

## ProjectStrategy multi-servicio — ADR-019 (2026-09-23)

- [ ] **[PS-01]** Importar `ProjectStrategyModule` + los 3 `{Eco}Module` en
      `pasarelapagos-backend/src/app.module.ts`
      → Done cuando: log de arranque muestra
      `Registry inicializado con estrategias: [WELVER, MANZANA, MEXUS, GENERIC]`

- [ ] **[PS-02]** Importar `ProjectStrategyModule` + los 3 `{Eco}Module` en
      `notificaciones-backend/src/app.module.ts`
      → Done cuando: mismo log de arranque en este servicio

- [ ] **[PS-03]** Completar `welver.strategy.ts` en pasarelapagos-backend con
      routing real de provider preferido de welver
      → Done cuando: `enrichPaymentContext` retorna `businessData` no vacío
      para al menos un caso real

- [ ] **[PS-04]** Completar `welver.strategy.ts` en notificaciones-backend con
      templates/canal preferido real de welver
      → Done cuando: `enrichNotificationContext` retorna overrides no vacíos

- [ ] **[PS-05]** Repetir PS-03/PS-04 para manzana y mexus cuando tengan
      requerimientos de negocio concretos — no antes (evitar lógica placeholder
      que nadie usa)

- [ ] **[PS-06]** Tipar `businessData` por ecosistema en
      `modules/{eco}/types/context.ts` de ambos servicios, reemplazando
      `Record<string, unknown>` — solo cuando PS-03/04 tengan contenido real
EOF
  echo "  [OK] lifecycle/tasks.md — sección agregada"
else
  echo "  [SKIP] lifecycle/tasks.md — sección ya existe"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. CLAUDE.md — referencia rápida (append, no destructivo)
# ─────────────────────────────────────────────────────────────────────────────
CLAUDE_MD="$CLAUDE_DIR/CLAUDE.md"
touch "$CLAUDE_MD"

if ! grep -q "## ProjectStrategy — personalización por ecosistema" "$CLAUDE_MD" 2>/dev/null; then
  cat >> "$CLAUDE_MD" <<'EOF'

---

## ProjectStrategy — personalización por ecosistema (ADR-019)

Patrón replicado desde chatia-backend hacia pasarelapagos-backend y
notificaciones-backend: el core del microservicio nunca conoce el
ecosistema concreto, solo el contrato `ProjectStrategy`. Ver
`architecture/12-project-strategy-pattern.md` para el detalle y el
criterio de "cuándo aplica" antes de replicarlo en un microservicio nuevo.

Estado: scaffold generado, wiring de `app.module.ts` pendiente (manual,
ver `lifecycle/tasks.md` sección PS-01/PS-02).

Referentes de industria: Salesforce (Custom Fields tipados — de ahí sale
la regla de no dejar `businessData` como `Record<string, unknown>` para
siempre) y Shopify (extensibilidad desacoplada del deploy — evolución
futura, no urgente hoy).
EOF
  echo "  [OK] CLAUDE.md — referencia agregada"
else
  echo "  [SKIP] CLAUDE.md — referencia ya existe"
fi

echo ""
echo "=== .claude/ actualizado ==="
echo ""
echo "Archivos nuevos:"
echo "  decisions/ADR-019-project-strategy-multi-servicio.md"
echo "  architecture/12-project-strategy-pattern.md"
echo ""
echo "Archivos actualizados (append):"
echo "  roadmap/deuda-tecnica.md"
echo "  lifecycle/tasks.md"
echo "  CLAUDE.md"
echo ""
echo "Pendiente real (no lo hace este script, es código no docs):"
echo "  → correr scaffold-project-strategy.sh si todavía no se corrió"
echo "  → wiring manual de app.module.ts en pasarelapagos y notificaciones"