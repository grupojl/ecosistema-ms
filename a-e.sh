#!/usr/bin/env bash
# Generado por x.sh — no editar manualmente
set -euo pipefail

BUGS=0
DEBTS=0
SERVICES="chatia-backend pasarelapagos-backend notificaciones-backend analytics-backend workers-backend"

BUG()  { echo "  ❌ [$1] $2"; BUGS=$((BUGS+1)); }
DEBT() { echo "  ⚠️  [$1] $2"; DEBTS=$((DEBTS+1)); }
OK()   { echo "  ✅ [$1] $2"; }

# Itera sobre todos los servicios
each_service() {
  for SVC in $SERVICES; do
    [[ -d "$SVC" ]] && "$@" "$SVC" || true
  done
}

echo "=== Audit E — Testing (ecosistema-ms) ==="
echo ""

# E1 — Módulos críticos sin service.spec.ts
echo "E1 — service.spec.ts en módulos críticos..."
E1_BUGS=0

declare -A CRITICAL_SERVICES
CRITICAL_SERVICES["chatia-backend"]="assignment conversations/conversations faq/query/faq-query"
CRITICAL_SERVICES["pasarelapagos-backend"]="modules/payments/payments modules/providers/routing audit/audit"
CRITICAL_SERVICES["notificaciones-backend"]="notifications/notifications notifications/dedup/idempotency.helper"
CRITICAL_SERVICES["analytics-backend"]="analytics/projections/projections analytics/analytics"
CRITICAL_SERVICES["workers-backend"]="jobs/services/circuit-breaker"

for SVC in $SERVICES; do
  MODS=${CRITICAL_SERVICES[$SVC]:-}
  for MOD_PATH in $MODS; do
    SVC_FILE="$SVC/src/${MOD_PATH}.ts"
    SPEC_FILE="$SVC/src/${MOD_PATH}.spec.ts"
    SPEC_ALT="$SVC/test/$(basename $MOD_PATH).spec.ts"
    [[ ! -f "$SVC_FILE" ]] && continue
    if [[ ! -f "$SPEC_FILE" && ! -f "$SPEC_ALT" ]]; then
      echo "     → [$SVC] sin spec: $(basename $MOD_PATH).ts"
      E1_BUGS=$((E1_BUGS+1))
    fi
  done
done
[[ $E1_BUGS -eq 0 ]] && OK "E1" "Todos los módulos críticos tienen service.spec.ts"                        || BUG "E1" "$E1_BUGS módulo(s) crítico(s) sin spec"

# E2 — Guards sin spec (TenantGuard + InternalApiKeyGuard — cobertura 100% requerida)
echo "E2 — Guards con spec (cobertura 100% requerida)..."
E2_BUGS=0
for SVC in $SERVICES; do
  for GUARD_PATTERN in "tenant.guard" "internal-api-key.guard" "roles.guard"; do
    GUARD_FILE=$(find "$SVC/src" -name "${GUARD_PATTERN}.ts" 2>/dev/null | head -1 || true)
    [[ -z "$GUARD_FILE" ]] && continue
    SPEC_FILE="${GUARD_FILE%.ts}.spec.ts"
    SPEC_ALT="$SVC/test/$(basename $GUARD_FILE .ts).spec.ts"
    if [[ ! -f "$SPEC_FILE" && ! -f "$SPEC_ALT" ]]; then
      echo "     → [$SVC] sin spec: $GUARD_PATTERN"
      E2_BUGS=$((E2_BUGS+1))
    fi
  done
done
[[ $E2_BUGS -eq 0 ]] && OK "E2" "Todos los guards tienen spec (cobertura 100%)"                        || BUG "E2" "$E2_BUGS guard(s) sin spec — cobertura 100% requerida"

# E3 — Payment state machine sin spec
echo "E3 — payment-state.machine.spec.ts..."
PSM_SPEC=$(find "pasarelapagos-backend" -name "payment-state.machine.spec.ts" 2>/dev/null | head -1 || true)
PSM_FILE=$(find "pasarelapagos-backend" -name "payment-state.machine.ts" 2>/dev/null | head -1 || true)
if [[ -f "$PSM_FILE" ]]; then
  [[ -n "$PSM_SPEC" ]] && OK "E3" "payment-state.machine.spec.ts presente"                           || BUG "E3" "payment-state.machine.ts sin spec — transiciones de estado sin cobertura"
else
  DEBT "E3" "payment-state.machine.ts no encontrado — crear con tests de transiciones válidas/inválidas"
fi

# E4 — Idempotency helper sin spec
echo "E4 — idempotency.helper.spec.ts..."
IDEM_FILE=$(find "notificaciones-backend" -name "idempotency.helper.ts" 2>/dev/null | head -1 || true)
IDEM_SPEC=$(find "notificaciones-backend" -name "idempotency.helper.spec.ts" 2>/dev/null | head -1 || true)
if [[ -f "$IDEM_FILE" ]]; then
  [[ -n "$IDEM_SPEC" ]] && OK "E4" "idempotency.helper.spec.ts presente"                            || BUG "E4" "idempotency.helper.ts sin spec — dedup sin cobertura"
else
  DEBT "E4" "idempotency.helper.ts no encontrado en notificaciones-backend"
fi

# E5 — Tests con snapshots (deuda)
echo "E5 — Sin snapshots en tests..."
E5=$(find $SERVICES -name "*.spec.ts" -o -name "*.test.ts" 2>/dev/null   | xargs grep -l "toMatchSnapshot\|toMatchInlineSnapshot" 2>/dev/null || true)
[[ -z "$E5" ]] && OK "E5" "Sin snapshots en tests"                || DEBT "E5" "Snapshots detectados — reemplazar con aserciones específicas"

# E6 — TenantContext mock canónico en tests (debe usar { ecosystemId, organizationId })
echo "E6 — TenantContext mock con ecosystemId + organizationId en tests..."
E6_MISSING=0
for SVC in $SERVICES; do
  SPECS=$(find "$SVC" -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
  if [[ $SPECS -gt 0 ]]; then
    # Al menos algún spec debe referenciar ecosystemId
    HAS_TENANT=$(grep -rn "ecosystemId\|organizationId" "$SVC" --include="*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
    if [[ $HAS_TENANT -eq 0 && $SPECS -gt 2 ]]; then
      echo "     → [$SVC] specs sin TenantContext ($SPECS specs, 0 con ecosystemId)"
      E6_MISSING=$((E6_MISSING+1))
    fi
  fi
done
[[ $E6_MISSING -eq 0 ]] && OK "E6" "Tests usan TenantContext con ecosystemId + organizationId"                           || DEBT "E6" "$E6_MISSING servicio(s) con tests sin contexto multi-tenant"

# E7 — Cobertura mínima: al menos N spec files por servicio
echo "E7 — Cantidad mínima de spec files por servicio..."
E7_BUGS=0
declare -A MIN_SPECS
MIN_SPECS["chatia-backend"]=3
MIN_SPECS["pasarelapagos-backend"]=3
MIN_SPECS["notificaciones-backend"]=2
MIN_SPECS["analytics-backend"]=1
MIN_SPECS["workers-backend"]=1

for SVC in $SERVICES; do
  SPEC_COUNT=$(find "$SVC" -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
  MIN=${MIN_SPECS[$SVC]:-1}
  if [[ $SPEC_COUNT -lt $MIN ]]; then
    echo "     → [$SVC] solo $SPEC_COUNT spec(s) — mínimo recomendado: $MIN"
    E7_BUGS=$((E7_BUGS+1))
  else
    echo "  ✅ [E7] [$SVC] $SPEC_COUNT spec(s) ≥ $MIN"
  fi
done
[[ $E7_BUGS -eq 0 ]] || BUG "E7" "$E7_BUGS servicio(s) por debajo del mínimo de specs"


echo ""
echo "────────────────────────────────────────"
if [[ $BUGS -eq 0 && $DEBTS -eq 0 ]]; then
  echo "  ✅  Sin hallazgos"
elif [[ $BUGS -eq 0 ]]; then
  echo "  ⚠️   0 bugs — $DEBTS deudas documentadas"
else
  echo "  ❌  $BUGS bug(s) bloqueante(s) — $DEBTS deuda(s)"
fi
echo "────────────────────────────────────────"
[[ $BUGS -eq 0 ]] && exit 0 || exit 1
