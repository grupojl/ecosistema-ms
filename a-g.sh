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

echo "=== Audit G — Deploy / Railway (ecosistema-ms) ==="
echo ""

# G1 — --platform=linux/amd64 en cada FROM de cada Dockerfile
echo "G1 — --platform=linux/amd64 en todos los Dockerfiles..."
G1_BUGS=0
for SVC in $SERVICES; do
  DF="$SVC/Dockerfile"
  [[ ! -f "$DF" ]] && { BUG "G1" "[$SVC] Dockerfile no encontrado"; G1_BUGS=$((G1_BUGS+1)); continue; }
  FROM_COUNT=$(grep -c "^FROM " "$DF" || true)
  PLATFORM_COUNT=$(grep -c "^FROM --platform=linux/amd64" "$DF" || true)
  if [[ "$FROM_COUNT" -ne "$PLATFORM_COUNT" ]]; then
    echo "     → [$SVC] FROMs: $FROM_COUNT, con --platform: $PLATFORM_COUNT"
    G1_BUGS=$((G1_BUGS+1))
  fi
done
[[ $G1_BUGS -eq 0 ]] && OK "G1" "--platform=linux/amd64 presente en todos los Dockerfiles"                        || BUG "G1" "$G1_BUGS servicio(s) con FROM sin --platform=linux/amd64"

# G2 — dumb-init en runtime stage
echo "G2 — dumb-init en runtime stage..."
G2_BUGS=0
for SVC in $SERVICES; do
  DF="$SVC/Dockerfile"
  [[ ! -f "$DF" ]] && continue
  if ! grep -q "dumb-init" "$DF"; then
    echo "     → [$SVC] sin dumb-init"
    G2_BUGS=$((G2_BUGS+1))
  fi
done
[[ $G2_BUGS -eq 0 ]] && OK "G2" "dumb-init presente en todos los Dockerfiles"                        || BUG "G2" "$G2_BUGS servicio(s) sin dumb-init"

# G3 — entrypoint.sh con prisma migrate deploy
echo "G3 — prisma migrate deploy en entrypoint.sh..."
G3_BUGS=0
for SVC in $SERVICES; do
  EP="$SVC/entrypoint.sh"
  [[ ! -f "$EP" ]] && { BUG "G3" "[$SVC] entrypoint.sh no encontrado"; G3_BUGS=$((G3_BUGS+1)); continue; }
  if ! grep -q "prisma migrate deploy" "$EP"; then
    echo "     → [$SVC] entrypoint.sh sin prisma migrate deploy"
    G3_BUGS=$((G3_BUGS+1))
  fi
done
[[ $G3_BUGS -eq 0 ]] && OK "G3" "prisma migrate deploy presente en todos los entrypoints"                        || BUG "G3" "$G3_BUGS servicio(s) sin prisma migrate deploy en entrypoint"

# G4 — HEALTHCHECK con puerto hardcodeado (no variable)
echo "G4 — HEALTHCHECK con puertos hardcodeados..."
G4_BUGS=0
for SVC in $SERVICES; do
  DF="$SVC/Dockerfile"
  [[ ! -f "$DF" ]] && continue
  if grep -q "HEALTHCHECK" "$DF"; then
    if grep "HEALTHCHECK" "$DF" | grep -qE '$[A-Z_]+|${[A-Z_]+}'; then
      echo "     → [$SVC] HEALTHCHECK usa variable (debe ser puerto fijo)"
      G4_BUGS=$((G4_BUGS+1))
    fi
  fi
done
[[ $G4_BUGS -eq 0 ]] && OK "G4" "HEALTHCHECK con puertos hardcodeados"                        || BUG "G4" "$G4_BUGS servicio(s) con HEALTHCHECK usando variables"

# G5 — /health extendido implementado (shape para superadmin)
echo "G5 — /health extendido con circuitBreakers + dlqDepth..."
G5_BUGS=0
for SVC in $SERVICES; do
  HEALTH_CTRL="$SVC/src/health/health.controller.ts"
  [[ ! -f "$HEALTH_CTRL" ]] && { BUG "G5" "[$SVC] health.controller.ts no encontrado"; G5_BUGS=$((G5_BUGS+1)); continue; }
  HAS_CB=$(grep -c "circuitBreakers\|circuitbreaker\|circuit_breakers\|CircuitBreaker" "$HEALTH_CTRL" 2>/dev/null || echo 0)
  HAS_DLQ=$(grep -c "dlqDepth\|dlq_depth\|DLQ\|dlq" "$HEALTH_CTRL" 2>/dev/null || echo 0)
  if [[ $HAS_CB -eq 0 || $HAS_DLQ -eq 0 ]]; then
    echo "     → [$SVC] /health sin circuitBreakers($HAS_CB) o dlqDepth($HAS_DLQ)"
    G5_BUGS=$((G5_BUGS+1))
  fi
done
[[ $G5_BUGS -eq 0 ]] && OK "G5" "/health extendido con circuitBreakers y dlqDepth en todos los servicios"                        || BUG "G5" "$G5_BUGS servicio(s) sin /health extendido — superadmin no puede monitorear"

# G6 — railway.json presente en cada servicio con healthcheckPath
echo "G6 — railway.json con healthcheckPath en cada servicio..."
G6_BUGS=0
for SVC in $SERVICES; do
  RJ="$SVC/railway.json"
  if [[ ! -f "$RJ" ]]; then
    echo "     → [$SVC] railway.json ausente"
    G6_BUGS=$((G6_BUGS+1))
  elif ! grep -q "healthcheckPath" "$RJ"; then
    echo "     → [$SVC] railway.json sin healthcheckPath"
    G6_BUGS=$((G6_BUGS+1))
  fi
done
[[ $G6_BUGS -eq 0 ]] && OK "G6" "railway.json con healthcheckPath en todos los servicios"                        || BUG "G6" "$G6_BUGS servicio(s) con railway.json incompleto"

# G7 — Cada servicio tiene su propio schema.prisma (DB aislada por servicio)
echo "G7 — schema.prisma por servicio (DB aislada)..."
G7_BUGS=0
for SVC in $SERVICES; do
  if [[ ! -f "$SVC/prisma/schema.prisma" ]]; then
    echo "     → [$SVC] prisma/schema.prisma no encontrado"
    G7_BUGS=$((G7_BUGS+1))
  fi
done
[[ $G7_BUGS -eq 0 ]] && OK "G7" "Cada servicio tiene su schema.prisma independiente"                        || BUG "G7" "$G7_BUGS servicio(s) sin schema.prisma"

# G8 — gRPC proto assets copiados en nest-cli.json
echo "G8 — proto assets en nest-cli.json..."
G8_BUGS=0
for SVC in $SERVICES; do
  NEST_CLI="$SVC/nest-cli.json"
  [[ ! -f "$NEST_CLI" ]] && { BUG "G8" "[$SVC] nest-cli.json no encontrado"; G8_BUGS=$((G8_BUGS+1)); continue; }
  if ! grep -q "proto" "$NEST_CLI"; then
    echo "     → [$SVC] nest-cli.json sin asset de .proto"
    G8_BUGS=$((G8_BUGS+1))
  fi
done
[[ $G8_BUGS -eq 0 ]] && OK "G8" "proto assets configurados en nest-cli.json"                        || BUG "G8" "$G8_BUGS servicio(s) sin proto assets en nest-cli.json"


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
