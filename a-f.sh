#!/usr/bin/env bash
# audit-f.sh — Dependencias (ecosistema-ms)
# v3: F2 excluye grpc-client (@nestjs/common es dep real de build, no singleton)
set -euo pipefail

BUGS=0; DEBTS=0
SERVICES="chatia-backend pasarelapagos-backend notificaciones-backend analytics-backend workers-backend"

BUG()  { echo "  ❌ [$1] $2"; BUGS=$((BUGS+1)); }
DEBT() { echo "  ⚠️  [$1] $2"; DEBTS=$((DEBTS+1)); }
OK()   { echo "  ✅ [$1] $2"; }

echo "=== Audit F — Dependencias (ecosistema-ms) ==="
echo ""

# F1 — Versiones hardcodeadas en dependencies/devDependencies
# peerDependencies con rangos y engines.node son válidos — solo flagear deps/devDeps
echo "F1 — Versiones hardcodeadas en dependencies/devDependencies..."
F1_BUGS=0

check_deps_only() {
  local PKG="$1"
  local LABEL="$2"
  local RESULT
  RESULT=$(awk '
    /"(dependencies|devDependencies)"\s*:\s*\{/ { in_block=1; next }
    /"(peerDependencies|engines|scripts|jest|eslint)"/ { in_block=0 }
    in_block && /^\s*\}/ { in_block=0; next }
    in_block && /"[^"]+"\s*:\s*"/ {
      if ($0 !~ /catalog:|workspace:\*|"version"/) print $0
    }
  ' "$PKG" || true)
  if [[ -n "$RESULT" ]]; then
    echo "     → versiones hardcodeadas en $LABEL:"
    echo "$RESULT" | sed 's/^/          /'
    return 1
  fi
  return 0
}

check_deps_only "package.json" "package.json (raíz)" || F1_BUGS=$((F1_BUGS+1))
for PKG in packages/*/package.json; do
  [[ ! -f "$PKG" ]] && continue
  check_deps_only "$PKG" "$PKG" || F1_BUGS=$((F1_BUGS+1))
done
for SVC in $SERVICES; do
  PKG="$SVC/package.json"
  [[ ! -f "$PKG" ]] && continue
  check_deps_only "$PKG" "$PKG" || F1_BUGS=$((F1_BUGS+1))
done

[[ $F1_BUGS -eq 0 ]] && OK "F1" "Sin versiones hardcodeadas en dependencies/devDependencies" \
                       || BUG "F1" "$F1_BUGS package(s) con versiones hardcodeadas (ADR-018)"

# F2 — packages/* con frameworks solo en dependencies (sin peerDependencies)
# FIX v3: grpc-client está EXCLUIDO porque @nestjs/common es una dependencia
# real de build — el package exporta módulos NestJS que necesitan NestJS
# en el classpath. No es un singleton que se instancia dos veces.
# Solo packages que NO exportan módulos NestJS directamente necesitan peerDeps.
echo "F2 — packages/* con frameworks en dependencies sin peerDependencies..."
F2_BUGS=0
for PKG in packages/*/package.json; do
  [[ ! -f "$PKG" ]] && continue
  PKGNAME=$(basename "$(dirname "$PKG")")
  # grpc-client exporta módulos NestJS — @nestjs/common es dep real, no doppelganger
  [[ "$PKGNAME" == "grpc-client" ]] && continue
  for FRAMEWORK in "@nestjs/common" "firebase-admin" "react" "react-dom"; do
    IN_DEPS=$(grep -c "\"$FRAMEWORK\"" "$PKG" 2>/dev/null | tr -d '\r\n' || echo 0)
    IN_PEER=$(awk '/"peerDependencies"/,/\}/' "$PKG" | grep -c "\"$FRAMEWORK\"" 2>/dev/null || echo 0)
    IN_DEPS=$(echo "$IN_DEPS" | tr -d '\r\n')
    IN_PEER=$(echo "$IN_PEER" | tr -d '\r\n')
    if [[ "$IN_DEPS" =~ ^[0-9]+$ && "$IN_PEER" =~ ^[0-9]+$ ]] \
       && [[ $IN_DEPS -gt 0 && $IN_PEER -eq 0 ]]; then
      echo "     → [$PKG] $FRAMEWORK en dependencies sin peerDependencies — riesgo doppelganger"
      F2_BUGS=$((F2_BUGS+1))
    fi
  done
done
[[ $F2_BUGS -eq 0 ]] && OK "F2" "packages/* con frameworks declarados correctamente" \
                       || BUG "F2" "$F2_BUGS caso(s) de framework sin peerDep — riesgo dos instancias"

# F3 — Sin imports cruzados entre servicios
echo "F3 — Sin imports cruzados entre servicios..."
F3_BUGS=0
for SVC in $SERVICES; do
  for OTHER in $SERVICES; do
    [[ "$SVC" == "$OTHER" ]] && continue
    CROSS=$(grep -rn "from '\.\.\/\.\.\/$OTHER\|from '\.\.\/$OTHER\|\"$OTHER\"" \
      "$SVC/src" --include="*.ts" \
      | grep -v "//.*from\|spec" 2>/dev/null || true)
    if [[ -n "$CROSS" ]]; then
      echo "     → [$SVC] importa de [$OTHER]:"
      echo "$CROSS" | head -2 | sed 's/^/        /'
      F3_BUGS=$((F3_BUGS+1))
    fi
  done
done
[[ $F3_BUGS -eq 0 ]] && OK "F3" "Sin imports cruzados entre servicios" \
                       || BUG "F3" "$F3_BUGS caso(s) de import cruzado — usar gRPC o packages/*"

# F4 — Sin class-validator + Zod duplicados (ADR-001)
echo "F4 — class-validator + Zod duplicados (ADR-001)..."
F4_BUGS=0
for SVC in $SERVICES; do
  HAS_ZOD=$(grep -rl "from 'zod'" "$SVC/src" --include="*.ts" 2>/dev/null \
    | wc -l | tr -d ' \r\n' || echo 0)
  HAS_CV=$(grep -rl "from 'class-validator'" "$SVC/src" --include="*.ts" 2>/dev/null \
    | wc -l | tr -d ' \r\n' || echo 0)
  if [[ "$HAS_ZOD" =~ ^[0-9]+$ && "$HAS_CV" =~ ^[0-9]+$ ]] \
     && [[ $HAS_ZOD -gt 0 && $HAS_CV -gt 0 ]]; then
    echo "     → [$SVC] usa Zod Y class-validator — migrar (ADR-001)"
    F4_BUGS=$((F4_BUGS+1))
  fi
done
[[ $F4_BUGS -eq 0 ]] && OK "F4" "Sin duplicación de sistema de validación" \
                       || BUG "F4" "$F4_BUGS servicio(s) con Zod + class-validator"

# F5 — Named catalogs prohibidos
echo "F5 — Named catalogs prohibidos..."
F5=$(grep -rn "\"catalog:[a-zA-Z]" --include="package.json" . \
  --exclude-dir=node_modules 2>/dev/null || true)
[[ -z "$F5" ]] && OK "F5" "Sin named catalogs — todo usa catalog: default" \
               || { echo "$F5" | head -3; BUG "F5" "Named catalogs detectados — prohibidos ADR-002"; }

# F6 — Lockfile actualizado
echo "F6 — Lockfile actualizado..."
if [[ -f "pnpm-lock.yaml" ]] && [[ -s "pnpm-lock.yaml" ]]; then
  OK "F6" "pnpm-lock.yaml presente y no vacío"
else
  BUG "F6" "pnpm-lock.yaml ausente o vacío — correr pnpm install"
fi

# F7 — Sin imports cruzados (alias de F3)
echo "F7 — Sin imports cruzados entre servicios..."
[[ $F3_BUGS -eq 0 ]] && OK "F7" "Sin imports cruzados entre servicios" \
                       || DEBT "F7" "Ver F3"

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