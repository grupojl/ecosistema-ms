#!/usr/bin/env bash
# audit-a.sh — Arquitectura de capas (ecosistema-ms)
# v2: fix A1 CRLF (Windows), fix descripción correcta de guards válidos por servicio
set -euo pipefail

BUGS=0; DEBTS=0
SERVICES="chatia-backend pasarelapagos-backend notificaciones-backend analytics-backend workers-backend"

BUG()  { echo "  ❌ [$1] $2"; BUGS=$((BUGS+1)); }
DEBT() { echo "  ⚠️  [$1] $2"; DEBTS=$((DEBTS+1)); }
OK()   { echo "  ✅ [$1] $2"; }

echo "=== Audit A — Arquitectura de capas (ecosistema-ms) ==="
echo ""

# A1 — gRPC controllers sin lógica de negocio (sin PrismaService directo)
# FIX v2: grep -c + tr -d '\r\n' + validación numérica para CRLF de Windows
echo "A1 — gRPC controllers sin lógica de negocio..."
A1_BUGS=0
for SVC in $SERVICES; do
  GRPC_CTRL=$(find "$SVC/src/grpc" -name "*grpc.controller.ts" 2>/dev/null \
    | grep -v "spec" || true)
  for f in $GRPC_CTRL; do
    [[ ! -f "$f" ]] && continue
    HAS_PRISMA=$(grep -c "PrismaService\|this\.prisma\." "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
    if [[ "$HAS_PRISMA" =~ ^[0-9]+$ ]] && [[ $HAS_PRISMA -gt 0 ]]; then
      echo "     → [$SVC] gRPC controller con acceso directo a Prisma: $(basename $f)"
      A1_BUGS=$((A1_BUGS+1))
    fi
  done
  # También verificar pagos.grpc.controller.ts que está fuera de grpc/
  EXTRA=$(find "$SVC/src" -name "*.grpc.controller.ts" 2>/dev/null \
    | grep -v "spec\|/grpc/" || true)
  for f in $EXTRA; do
    [[ ! -f "$f" ]] && continue
    HAS_PRISMA=$(grep -c "PrismaService\|this\.prisma\." "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
    if [[ "$HAS_PRISMA" =~ ^[0-9]+$ ]] && [[ $HAS_PRISMA -gt 0 ]]; then
      echo "     → [$SVC] gRPC controller con acceso directo a Prisma: $(basename $f)"
      A1_BUGS=$((A1_BUGS+1))
    fi
  done
done
[[ $A1_BUGS -eq 0 ]] && OK "A1" "gRPC controllers sin lógica de negocio" \
                       || BUG "A1" "$A1_BUGS gRPC controller(s) con PrismaService directo — mover al Service"

# A2 — analytics track() sin await en path crítico (fire-and-forget)
echo "A2 — analytics track() sin await en path crítico..."
A2=$(grep -rn "await.*analytics.*track\|await.*analyticsEvents.*track" \
  $SERVICES \
  --include="*.controller.ts" --include="*.service.ts" \
  | grep -v "analytics-events.service\|analytics.service\|//.*await" \
  2>/dev/null || true)
[[ -z "$A2" ]] && OK "A2" "analytics.track() no tiene await en paths críticos" \
               || BUG "A2" "await en analytics.track() — bloquea path crítico (ADR-004)"

# A3 — DLQ processors sin throw (solo loguean y ack)
echo "A3 — DLQ processors sin throw..."
A3_BUGS=0
for f in $(find $SERVICES -name "dlq*.processor.ts" -o -name "*dlq*.processor.ts" \
  2>/dev/null | grep -v spec || true); do
  [[ ! -f "$f" ]] && continue
  HAS_THROW=$(grep -c "^\s*throw " "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
  if [[ "$HAS_THROW" =~ ^[0-9]+$ ]] && [[ $HAS_THROW -gt 0 ]]; then
    echo "     → DLQ processor con throw: $(basename $f)"
    A3_BUGS=$((A3_BUGS+1))
  fi
done
[[ $A3_BUGS -eq 0 ]] && OK "A3" "DLQ processors sin throw (solo loguean y ack)" \
                       || BUG "A3" "$A3_BUGS DLQ processor(s) con throw — deben solo loguear"

# A4 — Sin nuevos DTOs con class-validator post-ADR-001
echo "A4 — Sin nuevos DTOs con class-validator post-ADR-001..."
A4=$(grep -rn "@IsString\|@IsEmail\|@IsNumber\|@IsBoolean\|@IsOptional\|@IsNotEmpty" \
  $SERVICES \
  --include="*.ts" \
  | grep -v "//.*@Is\|spec\|node_modules" \
  2>/dev/null || true)
[[ -z "$A4" ]] && OK "A4" "Sin decorators class-validator en código" \
               || BUG "A4" "class-validator detectado — migrar a Zod (ADR-001)"

# A5 — Módulos con Domain/Repository usan IRepository (no PrismaService directo en services)
echo "A5 — Módulos con Domain/Repository sin usar IRepository..."
A5_BUGS=0
for f in $(find $SERVICES -path "*/domain/*.entity.ts" 2>/dev/null || true); do
  SVC=$(echo "$f" | cut -d'/' -f1)
  MODULE=$(echo "$f" | cut -d'/' -f3)
  SERVICE_FILE="$SVC/src/$MODULE/${MODULE}.service.ts"
  [[ ! -f "$SERVICE_FILE" ]] && continue
  HAS_PRISMA=$(grep -c "PrismaService\|this\.prisma\." "$SERVICE_FILE" 2>/dev/null | tr -d '\r\n' || echo 0)
  HAS_REPO=$(grep -c "@Inject\|IRepository\|Repository\b" "$SERVICE_FILE" 2>/dev/null | tr -d '\r\n' || echo 0)
  if [[ "$HAS_PRISMA" =~ ^[0-9]+$ && "$HAS_REPO" =~ ^[0-9]+$ ]] \
     && [[ $HAS_PRISMA -gt 0 && $HAS_REPO -eq 0 ]]; then
    echo "     → [$SVC/$MODULE] service con domain/ usa PrismaService directo sin IRepository"
    A5_BUGS=$((A5_BUGS+1))
  fi
done
[[ $A5_BUGS -eq 0 ]] && OK "A5" "Módulos con domain/ usan IRepository correctamente" \
                       || BUG "A5" "$A5_BUGS módulo(s) con domain/ usando PrismaService directo"

# A6 — BullMQ jobs con jobId idempotente
# Reporta como DEUDA (no bug) — solo queues críticas requieren jobId
echo "A6 — BullMQ jobs con jobId idempotente..."
A6_DEBTS=0
for SVC in $SERVICES; do
  COUNT=$(grep -rn "queue\.add\|this\.\w*[Qq]ueue\.add" "$SVC/src" \
    --include="*.ts" \
    | grep -v "jobId\|spec\|//.*add" \
    2>/dev/null | wc -l | tr -d ' \r\n' || echo 0)
  if [[ "$COUNT" =~ ^[0-9]+$ ]] && [[ $COUNT -gt 0 ]]; then
    DEBT "A6" "[$SVC] $COUNT job(s) encolados sin jobId explícito — riesgo de duplicados (ADR-003)"
    A6_DEBTS=$((A6_DEBTS+1))
  fi
done
[[ $A6_DEBTS -eq 0 ]] && OK "A6" "Todos los jobs BullMQ tienen jobId explícito"

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