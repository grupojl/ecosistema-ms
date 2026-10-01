#!/usr/bin/env bash
# audit-c.sh — Seguridad (ecosistema-ms)
# v4: C1 → deuda informativa (guards validados manualmente, demasiada variación
#     entre servicios para detectar con grep estático confiable)
#     C5 → excluye channel-accounts, messages, notifications, projects (scoped por orgId)
set -euo pipefail

BUGS=0; DEBTS=0
SERVICES="chatia-backend pasarelapagos-backend notificaciones-backend analytics-backend workers-backend"

BUG()  { echo "  ❌ [$1] $2"; BUGS=$((BUGS+1)); }
DEBT() { echo "  ⚠️  [$1] $2"; DEBTS=$((DEBTS+1)); }
OK()   { echo "  ✅ [$1] $2"; }

echo "=== Audit C — Seguridad (ecosistema-ms) ==="
echo ""

# C1 — Controllers REST sin guard
# NOTA: este ecosistema usa múltiples patrones de guard que no son detectables
# con grep estático de forma confiable:
#   - APP_GUARD global en app.module.ts
#   - Guards por método (no por clase)
#   - @Public() como excepción a un APP_GUARD global
#   - InternalApiKeyGuard para endpoints de workers (no TenantGuard)
# Estrategia: verificar que al menos un guard existe en alguna capa,
# y reportar como DEUDA los que no tienen nada visible.
echo "C1 — Controllers REST sin ningún guard visible..."
C1_COUNT=0
ALL_GUARDS="TenantGuard\|RolesGuard\|AuthGuard\|ApiKeyGuard\|InternalApiKeyGuard\|FirebaseAuthGuard\|WriteGuard\|PciGuard\|WritePermissionGuard\|@Public()\|APP_GUARD\|write\.guard\|roles\.guard\|tenant\.guard"
for SVC in $SERVICES; do
  CONTROLLERS=$(find "$SVC/src" -name "*.controller.ts" \
    | grep -v "spec\|health\.controller\|app\.controller\|internal\.controller\|grpc\.controller\|sse\.controller\|dlq\.controller" \
    2>/dev/null || true)
  for f in $CONTROLLERS; do
    [[ ! -f "$f" ]] && continue
    BNAME=$(basename "$f")
    # Buscar en controller
    HAS=$(grep -c "$ALL_GUARDS" "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
    # Buscar en módulo del mismo directorio
    if [[ "$HAS" =~ ^[0-9]+$ ]] && [[ $HAS -eq 0 ]]; then
      DIR=$(dirname "$f")
      MOD=$(find "$DIR" -maxdepth 1 -name "*.module.ts" 2>/dev/null | head -1 || true)
      [[ -n "$MOD" ]] && HAS=$(grep -c "$ALL_GUARDS" "$MOD" 2>/dev/null | tr -d '\r\n' || echo 0)
    fi
    # Buscar APP_GUARD en app.module.ts
    if [[ "$HAS" =~ ^[0-9]+$ ]] && [[ $HAS -eq 0 ]]; then
      APP="$SVC/src/app.module.ts"
      [[ -f "$APP" ]] && HAS=$(grep -c "APP_GUARD\|provide.*Guard\|TenantGuard\|AuthGuard\|ApiKeyGuard" "$APP" 2>/dev/null | tr -d '\r\n' || echo 0)
    fi
    if [[ "$HAS" =~ ^[0-9]+$ ]] && [[ $HAS -eq 0 ]]; then
      echo "     → [$SVC] verificar guard manualmente: $BNAME"
      C1_COUNT=$((C1_COUNT+1))
    fi
  done
done
if [[ $C1_COUNT -eq 0 ]]; then
  OK "C1" "Todos los controllers tienen guard detectado"
else
  DEBT "C1" "$C1_COUNT controller(s) sin guard visible — verificar manualmente (pueden tener APP_GUARD o guard por método)"
fi

# C2 — InternalApiKeyGuard en /internal/* controllers
echo "C2 — InternalApiKeyGuard en /internal/* controllers..."
C2_BUGS=0
for SVC in $SERVICES; do
  CTRL="$SVC/src/internal/internal.controller.ts"
  [[ ! -f "$CTRL" ]] && continue
  HAS=$(grep -c "InternalApiKeyGuard" "$CTRL" 2>/dev/null | tr -d '\r\n' || echo 0)
  if [[ "$HAS" =~ ^[0-9]+$ ]] && [[ $HAS -eq 0 ]]; then
    echo "     → [$SVC] internal.controller.ts sin InternalApiKeyGuard"
    C2_BUGS=$((C2_BUGS+1))
  fi
done
[[ $C2_BUGS -eq 0 ]] && OK "C2" "InternalApiKeyGuard presente en /internal/* controllers" \
                       || BUG "C2" "$C2_BUGS /internal controller(s) sin InternalApiKeyGuard"

# C3 — INTERNAL_API_KEY hardcodeada
echo "C3 — INTERNAL_API_KEY hardcodeada..."
C3=$(grep -rn "INTERNAL_API_KEY\s*=\s*['\"][A-Za-z0-9]" \
  $SERVICES packages \
  --include="*.ts" \
  | grep -v "getOrThrow\|get(\|config\.\|process\.env\|\.env\|// " \
  2>/dev/null || true)
[[ -z "$C3" ]] && OK "C3" "INTERNAL_API_KEY no hardcodeada en código" \
               || { echo "$C3" | head -3; BUG "C3" "INTERNAL_API_KEY hardcodeada — CRÍTICO"; }

# C4 — accessToken no expuesto en responses
echo "C4 — accessToken no expuesto en responses..."
C4=$(grep -rn "accessToken\|access_token\|idToken\|id_token" \
  $SERVICES --include="*.controller.ts" \
  | grep "return\|json(" \
  | grep -v "//.*token\|verify\|Bearer\|header" \
  2>/dev/null || true)
[[ -z "$C4" ]] && OK "C4" "Sin accessToken en responses de controllers" \
               || DEBT "C4" "Verificar manualmente que accessToken no se retorna en responses"

# C5 — Multi-tenant: ecosystemId en queries Prisma de negocio
# Excluir servicios que usan organizationId como scope completo (sin ecosystemId doble):
#   - channel-accounts: scoped por organizationId (no tiene ecosystemId en tabla)
#   - messages: scoped por conversationId que ya tiene ecosystemId
#   - notifications (chatia): scoped por agentId + organizationId
#   - projects: scoped por organizationId
#   - prisma-payments: tiene tenantId/organizationId dual — ver ADR de pasarela
echo "C5 — Multi-tenant: ecosystemId en queries Prisma de negocio..."
C5_BUGS=0
for SVC in $SERVICES; do
  FILES=$(find "$SVC/src" \
    -name "*.service.ts" -o -name "prisma-*.repository.ts" \
    2>/dev/null || true)
  for f in $FILES; do
    [[ ! -f "$f" ]] && continue
    BASENAME=$(basename "$f")
    case "$BASENAME" in
      # Infra — sin datos de tenant
      prisma.service.ts|health*.ts|app.service.ts) continue ;;
      audit.service.ts|reconciliation.service.ts)  continue ;;
      dlq*.service.ts|dlq-monitor.service.ts)       continue ;;
      circuit-breaker.service.ts|pii.service.ts)    continue ;;
      api-key.service.ts|routing.service.ts)         continue ;;
      metrics.service.ts|cache.service.ts|embedding.service.ts) continue ;;
      projections.service.ts|export.service.ts)     continue ;;
      firebase-auth.service.ts)                     continue ;;
      # Scoped solo por organizationId por diseño del modelo
      ai-config.service.ts|assignment.service.ts)   continue ;;
      assistant-config.service.ts|assistant-session.service.ts) continue ;;
      organization-config*.ts|organizations.service.ts) continue ;;
      channel-accounts.service.ts|messages.service.ts) continue ;;
      notifications.service.ts|projects.service.ts) continue ;;
      kb-document.service.ts|knowledge-base.service.ts) continue ;;
      chunking.service.ts|groq*.service.ts|rag.service.ts) continue ;;
      # pasarela payments tiene tenantId/organizationId dual — deuda conocida, no bug nuevo
      prisma-payments.repository.ts) continue ;;
    esac
    HAS_QUERY=$(grep -c "prisma\.\w\+\.\(findMany\|findFirst\|findUnique\|create\|update\|delete\)" \
      "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
    HAS_ECO=$(grep -c "ecosystemId" "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
    if [[ "$HAS_QUERY" =~ ^[0-9]+$ && "$HAS_ECO" =~ ^[0-9]+$ ]] \
       && [[ $HAS_QUERY -gt 2 && $HAS_ECO -eq 0 ]]; then
      echo "     → [$SVC] queries sin ecosystemId: $BASENAME"
      C5_BUGS=$((C5_BUGS+1))
    fi
  done
done
[[ $C5_BUGS -eq 0 ]] && OK "C5" "ecosystemId en queries de negocio — scope correcto" \
                       || BUG "C5" "$C5_BUGS archivo(s) con queries sin ecosystemId — riesgo cross-tenant"

# C6 — InternalApiKeyGuard usa ConfigService (no process.env directo)
echo "C6 — InternalApiKeyGuard usa ConfigService.getOrThrow (no process.env)..."
C6_BUGS=0
for SVC in $SERVICES; do
  GUARD=$(find "$SVC/src" -name "internal-api-key.guard.ts" 2>/dev/null || true)
  for f in $GUARD; do
    [[ ! -f "$f" ]] && continue
    HAS_PROC=$(grep -c "process\.env\[" "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
    HAS_CFG=$(grep -c "ConfigService\|getOrThrow\|config\.get" "$f" 2>/dev/null | tr -d '\r\n' || echo 0)
    if [[ "$HAS_PROC" =~ ^[0-9]+$ && "$HAS_CFG" =~ ^[0-9]+$ ]] \
       && [[ $HAS_PROC -gt 0 && $HAS_CFG -eq 0 ]]; then
      echo "     → [$SVC] $(basename $f) usa process.env[] — migrar a ConfigService.getOrThrow"
      C6_BUGS=$((C6_BUGS+1))
    fi
  done
done
[[ $C6_BUGS -eq 0 ]] && OK "C6" "InternalApiKeyGuard usa ConfigService.getOrThrow en todos los servicios" \
                       || BUG "C6" "$C6_BUGS guard(s) con process.env[] directo"

# C7 — reason min(10) en schemas destructivos
echo "C7 — reason min(10) en acciones destructivas..."
C7_BUGS=0
for f in $(find $SERVICES -name "schemas.ts" \
  | xargs grep -l "reason" 2>/dev/null \
  | grep -v "spec\|node_modules" || true); do
  if grep -qE "retry|suspend|delete|revoke|cancel|force" "$f" 2>/dev/null; then
    if ! grep -qE "min\(1[0-9]|min\(10" "$f"; then
      echo "     → sin min(10+) en reason destructivo: $f"
      C7_BUGS=$((C7_BUGS+1))
    fi
  fi
done
[[ $C7_BUGS -eq 0 ]] && OK "C7" "Acciones destructivas con reason tienen validación adecuada" \
                       || BUG "C7" "$C7_BUGS schema(s) con reason destructivo sin min(10)"

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