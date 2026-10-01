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

echo "=== Audit D — Observabilidad (ecosistema-ms) ==="
echo ""

# D1 — /metrics Prometheus expuesto en cada servicio
echo "D1 — /metrics Prometheus expuesto..."
D1_BUGS=0
for SVC in $SERVICES; do
  HAS_METRICS=$(grep -rn "metrics\|prometheus\|prom-client\|PrometheusModule\|MetricsModule"     "$SVC/src" --include="*.ts" --include="*.module.ts" 2>/dev/null | wc -l | tr -d ' ')
  if [[ $HAS_METRICS -eq 0 ]]; then
    echo "     → [$SVC] sin /metrics endpoint"
    D1_BUGS=$((D1_BUGS+1))
  fi
done
[[ $D1_BUGS -eq 0 ]] && OK "D1" "/metrics Prometheus configurado en todos los servicios"                        || BUG "D1" "$D1_BUGS servicio(s) sin /metrics"

# D2 — Logger inyectado en services (NestJS Logger o pino)
echo "D2 — Logger en services..."
D2_MISSING=0
for SVC in $SERVICES; do
  for f in $(find "$SVC/src" -name "*.service.ts" | grep -v "spec\|prisma" 2>/dev/null || true); do
    if ! grep -q "Logger\|logger\|pino" "$f" 2>/dev/null; then
      D2_MISSING=$((D2_MISSING+1))
    fi
  done
done
[[ $D2_MISSING -eq 0 ]] && OK "D2" "Todos los services tienen Logger"                           || DEBT "D2" "$D2_MISSING service(s) sin Logger de NestJS"

# D3 — /health con db + redis latencias
echo "D3 — /health con DB y Redis latencias..."
D3_BUGS=0
for SVC in $SERVICES; do
  HEALTH="$SVC/src/health/health.controller.ts"
  [[ ! -f "$HEALTH" ]] && { BUG "D3" "[$SVC] health.controller.ts no encontrado"; D3_BUGS=$((D3_BUGS+1)); continue; }
  HAS_DB=$(grep -c "db\|prisma\|database\|latency\|ping" "$HEALTH" 2>/dev/null || echo 0)
  HAS_REDIS=$(grep -c "redis\|Redis" "$HEALTH" 2>/dev/null || echo 0)
  if [[ $HAS_DB -eq 0 || $HAS_REDIS -eq 0 ]]; then
    echo "     → [$SVC] /health sin DB($HAS_DB) o Redis($HAS_REDIS)"
    D3_BUGS=$((D3_BUGS+1))
  fi
done
[[ $D3_BUGS -eq 0 ]] && OK "D3" "/health reporta estado de DB y Redis en todos los servicios"                        || BUG "D3" "$D3_BUGS servicio(s) con /health incompleto"

# D4 — RequestIdMiddleware (Correlation ID) en todos los servicios
echo "D4 — RequestIdMiddleware (Correlation ID) en cada servicio..."
D4_BUGS=0
for SVC in $SERVICES; do
  HAS_MIDDLEWARE=$(find "$SVC/src" -name "request-id.middleware.ts" 2>/dev/null | wc -l | tr -d ' ')
  HAS_APPLIED=$(grep -rn "RequestIdMiddleware\|request-id" "$SVC/src/app.module.ts" 2>/dev/null | wc -l | tr -d ' ')
  if [[ $HAS_MIDDLEWARE -eq 0 ]]; then
    echo "     → [$SVC] sin request-id.middleware.ts"
    D4_BUGS=$((D4_BUGS+1))
  elif [[ $HAS_APPLIED -eq 0 ]]; then
    echo "     → [$SVC] RequestIdMiddleware existe pero no está aplicado en app.module.ts"
    D4_BUGS=$((D4_BUGS+1))
  fi
done
[[ $D4_BUGS -eq 0 ]] && OK "D4" "RequestIdMiddleware aplicado en todos los servicios"                        || BUG "D4" "$D4_BUGS servicio(s) sin Correlation ID middleware"

# D5 — Circuit Breaker estados expuestos en /health
echo "D5 — Circuit Breaker estados en /health..."
D5_DEBTS=0
for SVC in chatia-backend pasarelapagos-backend notificaciones-backend workers-backend; do
  # analytics y workers tienen CB vacío — es correcto según superadmin-api.md
  HEALTH="$SVC/src/health/health.controller.ts"
  [[ ! -f "$HEALTH" ]] && continue
  if ! grep -q "circuitBreaker\|CircuitBreaker\|circuit_breaker\|getState\|getAllState" "$HEALTH" 2>/dev/null; then
    echo "     → [$SVC] /health sin estado de Circuit Breakers"
    D5_DEBTS=$((D5_DEBTS+1))
  fi
done
[[ $D5_DEBTS -eq 0 ]] && OK "D5" "Circuit Breaker estados expuestos en /health"                          || DEBT "D5" "$D5_DEBTS servicio(s) sin CB state en /health — superadmin no puede detectar degradación"

# D6 — BullMQ jobs con logging en procesadores
echo "D6 — BullMQ processors con Logger..."
D6_DEBTS=0
for SVC in $SERVICES; do
  for f in $(find "$SVC/src" -name "*.processor.ts" 2>/dev/null || true); do
    if ! grep -q "Logger\|logger\|this\.log" "$f" 2>/dev/null; then
      echo "     → [$SVC] processor sin Logger: $(basename $f)"
      D6_DEBTS=$((D6_DEBTS+1))
    fi
  done
done
[[ $D6_DEBTS -eq 0 ]] && OK "D6" "Todos los BullMQ processors tienen Logger"                          || DEBT "D6" "$D6_DEBTS processor(s) sin Logger — jobs fallidos invisibles en prod"


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
