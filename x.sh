#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix auth-server/src/index.ts: agregar .js a todos los exports
# El archivo importa './decorators/public.decorator' sin .js — ESM lo requiere
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

AUTH_INDEX="$ROOT/packages/auth-server/src/index.ts"

log "Leyendo auth-server/src/index.ts..."
cat "$AUTH_INDEX"
echo ""

log "Contenido actual de auth-server/src/:"
ls "$ROOT/packages/auth-server/src/" 2>/dev/null || echo "carpeta no encontrada"
ls "$ROOT/packages/auth-server/src/decorators/" 2>/dev/null || echo "decorators no encontrada"

echo ""
log "Reescribiendo index.ts con .js en todos los exports..."

# Leer el archivo actual y agregar .js a todos los imports/exports relativos sin extensión
# Patrón: from './xxx' o from '../xxx' sin .js al final
sed -i \
  -e "s|from '\(\./[^']*\)'|from '\1.js'|g" \
  -e "s|from '\(\.\./[^']*\)'|from '\1.js'|g" \
  -e "s|\.js\.js|.js|g" \
  "$AUTH_INDEX"

log "Resultado después del fix:"
cat "$AUTH_INDEX"

ok "auth-server/src/index.ts — .js agregado a imports"
echo ""
echo "Próximo: make g → push → Railway redeploy"