#!/usr/bin/env bash
# x-obs-ecosistema-ms.sh — Observabilidad D2 + D5 (ecosistema-ms)
# D2: Logger en los services sin él
# D5: getAll() en CircuitBreakerService de pasarelapagos-backend
# Sin Python — solo bash + awk
# Uso: bash x-obs-ecosistema-ms.sh  (desde la raíz del monorepo)
set -euo pipefail

OK()   { echo "  ✅ $1"; }
SKIP() { echo "  ⏭️  $1"; }
WARN() { echo "  ⚠️  $1"; }
ERR()  { echo "  ❌ $1"; exit 1; }

echo "=== x-obs-ecosistema-ms.sh — D2 + D5 ==="
echo ""

[[ -f "chatia-backend/src/app.module.ts" ]] \
  || ERR "No se encuentra chatia-backend/src/app.module.ts — ejecutar desde la raíz del monorepo"

# =============================================================================
# D5 — getAll() en CircuitBreakerService de pasarelapagos-backend
# El health.controller.ts llama this.cb.getAll() pero el service
# solo tiene healthOf(key) individual. Agregar getAll() que itera
# sobre todos los breakers registrados en el Map.
# =============================================================================
echo "── D5: CircuitBreakerService.getAll() en pasarelapagos ──────────────────"

CB_SVC="pasarelapagos-backend/src/modules/providers/circuit-breaker.service.ts"

[[ -f "$CB_SVC" ]] || { WARN "D5 — $CB_SVC no encontrado"; }

if grep -q "getAll()" "$CB_SVC" 2>/dev/null; then
  SKIP "D5 — getAll() ya existe en $CB_SVC"
else
  cp "$CB_SVC" "${CB_SVC}.bak"

  # Insertar getAll() después del método healthOf()
  # healthOf() termina con "return 'closed';\n  }"
  awk '
    /return '\''closed'\'';/ && in_health {
      print $0
      # Cierre del método healthOf
      next
    }
    /healthOf\(key: string\)/ { in_health=1 }
    in_health && /^\s*\}$/ {
      in_health=0
      print $0
      print ""
      print "  /**"
      print "   * Retorna el estado de todos los circuit breakers registrados."
      print "   * Usado por health.controller.ts para el /health extendido."
      print "   * Keys: mercadopago, stripe, dlocal, conekta, pagarme (según providers activos)"
      print "   */"
      print "  getAll(): Record<string, '\''CLOSED'\'' | '\''OPEN'\'' | '\''HALF_OPEN'\''> {"
      print "    const result: Record<string, '\''CLOSED'\'' | '\''OPEN'\'' | '\''HALF_OPEN'\''> = {};"
      print "    for (const key of this.breakers.keys()) {"
      print "      const state = this.healthOf(key);"
      print "      if (state !== '\''unknown'\'') {"
      print "        result[key] = state === '\''closed'\''   ? '\''CLOSED'\''"
      print "                    : state === '\''open'\''     ? '\''OPEN'\''"
      print "                    : '\''HALF_OPEN'\'';"
      print "      }"
      print "    }"
      print "    return result;"
      print "  }"
      next
    }
    { print }
  ' "$CB_SVC" > "${CB_SVC}.tmp" && mv "${CB_SVC}.tmp" "$CB_SVC"

  grep -q "getAll()" "$CB_SVC" \
    && OK "D5 — getAll() agregado a CircuitBreakerService de pasarelapagos" \
    || { WARN "D5 — awk no insertó getAll() — aplicar manualmente"; cp "${CB_SVC}.bak" "$CB_SVC"
         echo ""
         echo "  Manual — agregar en $CB_SVC después de healthOf():"
         echo "  getAll(): Record<string, 'CLOSED' | 'OPEN' | 'HALF_OPEN'> {"
         echo "    const result: Record<string, 'CLOSED' | 'OPEN' | 'HALF_OPEN'> = {};"
         echo "    for (const key of this.breakers.keys()) {"
         echo "      const state = this.healthOf(key);"
         echo "      if (state !== 'unknown') {"
         echo "        result[key] = state === 'closed' ? 'CLOSED' : state === 'open' ? 'OPEN' : 'HALF_OPEN';"
         echo "      }"
         echo "    }"
         echo "    return result;"
         echo "  }"; }

  rm -f "${CB_SVC}.bak" 2>/dev/null || true
fi

echo ""

# =============================================================================
# D2 — Logger en services sin él
# Busca services sin "new Logger(" y agrega la propiedad + import si falta
# =============================================================================
echo "── D2: Logger en services ────────────────────────────────────────────────"

# Lista de services candidatos (los que típicamente no tienen Logger)
declare -A SERVICE_MAP
SERVICE_MAP["chatia-backend/src/analytics/analytics.service.ts"]="AnalyticsService"
SERVICE_MAP["chatia-backend/src/ecosystem/ecosystem.service.ts"]="EcosystemService"
SERVICE_MAP["chatia-backend/src/organizations/organizations.service.ts"]="OrganizationsService"
SERVICE_MAP["chatia-backend/src/faq/ingestion/faq-ingestion.service.ts"]="FaqIngestionService"
SERVICE_MAP["chatia-backend/src/faq/query/faq-query.service.ts"]="FaqQueryService"
SERVICE_MAP["chatia-backend/src/messages/messages.service.ts"]="MessagesService"
SERVICE_MAP["chatia-backend/src/projects/projects.service.ts"]="ProjectsService"
SERVICE_MAP["pasarelapagos-backend/src/modules/tenants/tenants.module.ts"]=""
SERVICE_MAP["notificaciones-backend/src/preferences/preferences.service.ts"]="PreferencesService"
SERVICE_MAP["analytics-backend/src/analytics/analytics.service.ts"]="AnalyticsService"
SERVICE_MAP["workers-backend/src/campaigns/campaigns.service.ts"]="CampaignsService"

for FILE in "${!SERVICE_MAP[@]}"; do
  CLASS="${SERVICE_MAP[$FILE]}"
  [[ -z "$CLASS" ]] && continue   # saltar si no hay clase definida
  [[ ! -f "$FILE" ]] && continue  # saltar si no existe

  # Ya tiene Logger?
  if grep -q "new Logger(" "$FILE" 2>/dev/null; then
    SKIP "D2 — $(basename $FILE) ya tiene Logger"
    continue
  fi

  cp "$FILE" "${FILE}.bak"

  # Paso 1: agregar Logger al import de @nestjs/common si no está
  if grep -q "@nestjs/common" "$FILE" && ! grep -q "Logger" "$FILE"; then
    awk '
      /@nestjs\/common/ && !/Logger/ {
        sub(/import \{/, "import { Logger,")
        print; next
      }
      { print }
    ' "$FILE" > "${FILE}.tmp" && mv "${FILE}.tmp" "$FILE"
  elif ! grep -q "@nestjs/common" "$FILE"; then
    awk 'NR==1 { print "import { Logger } from '\''@nestjs/common'\'';" } { print }' \
      "$FILE" > "${FILE}.tmp" && mv "${FILE}.tmp" "$FILE"
  fi

  # Paso 2: agregar private readonly logger dentro de la clase
  awk -v class="$CLASS" '
    $0 ~ ("export class " class) {
      print $0
      print "  private readonly logger = new Logger(" class ".name);"
      next
    }
    { print }
  ' "$FILE" > "${FILE}.tmp" && mv "${FILE}.tmp" "$FILE"

  grep -q "new Logger(" "$FILE" \
    && OK "D2 — Logger agregado a $(basename $FILE)" \
    || { WARN "D2 — no se pudo agregar Logger a $(basename $FILE) — verificar manualmente"
         cp "${FILE}.bak" "$FILE"; }

  rm -f "${FILE}.bak" 2>/dev/null || true
done

# También barrer todos los services del monorepo que no tengan Logger
# (por si el audit detecta más de los listados arriba)
echo ""
echo "  Barrido adicional de services sin Logger..."
EXTRA=0
for SVC in chatia-backend pasarelapagos-backend notificaciones-backend analytics-backend workers-backend; do
  for f in $(find "$SVC/src" -name "*.service.ts" \
    | grep -v "spec\|prisma.service\|circuit-breaker\|cache.service\|embedding\|routing\|pii\|firebase\|groq\|rag\|chunking" \
    2>/dev/null || true); do
    [[ ! -f "$f" ]] && continue
    if ! grep -q "new Logger(" "$f" 2>/dev/null; then
      # Intentar extraer el nombre de la clase
      CLASS=$(grep -m1 "export class " "$f" | sed 's/.*export class \([A-Za-z]*\).*/\1/' | tr -d '\r' || true)
      [[ -z "$CLASS" ]] && continue

      cp "$f" "${f}.bak"

      # Agregar Logger al import
      if grep -q "@nestjs/common" "$f" && ! grep -q "Logger" "$f"; then
        awk '
          /@nestjs\/common/ && !/Logger/ {
            sub(/import \{/, "import { Logger,")
            print; next
          }
          { print }
        ' "$f" > "${f}.tmp" && mv "${f}.tmp" "$f"
      fi

      # Agregar propiedad
      awk -v class="$CLASS" '
        $0 ~ ("export class " class) {
          print $0
          print "  private readonly logger = new Logger(" class ".name);"
          next
        }
        { print }
      ' "$f" > "${f}.tmp" && mv "${f}.tmp" "$f"

      if grep -q "new Logger(" "$f" 2>/dev/null; then
        OK "D2 — Logger agregado a $(basename $f)"
        EXTRA=$((EXTRA+1))
      else
        cp "${f}.bak" "$f"
      fi

      rm -f "${f}.bak" 2>/dev/null || true
    fi
  done
done
[[ $EXTRA -eq 0 ]] && echo "  ℹ️  Sin services adicionales sin Logger" || echo "  ℹ️  $EXTRA service(s) adicionales actualizados"

echo ""
echo "────────────────────────────────────────────────────────────────────────"
echo "  Listo. Ejecutar: bash audit-d.sh → D2 y D5 deben pasar ✅"
echo "────────────────────────────────────────────────────────────────────────"