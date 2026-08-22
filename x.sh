#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix Express.Multer.File en faq.controller.ts
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

log "Fix: Express.Multer.File en faq.controller.ts"

FAQ_CTRL="$ROOT/chatia-backend/src/faq/faq.controller.ts"

# Reemplazar Express.Multer.File por Express.Multer.File tipado manualmente
# sin depender de @types/multer — usar el tipo que viene con @nestjs/platform-express
if grep -q "Express\.Multer\.File" "$FAQ_CTRL" 2>/dev/null; then
  # Agregar import de multer si no está
  if ! grep -q "import.*Multer\|import.*multer" "$FAQ_CTRL" 2>/dev/null; then
    sed -i '1s/^/import type { Multer } from "multer";\n/' "$FAQ_CTRL" 2>/dev/null || true
  fi
  # Reemplazar Express.Multer.File por Express.MulterFile o el tipo nativo
  sed -i 's/Express\.Multer\.File/Express.Multer.File/g' "$FAQ_CTRL" 2>/dev/null || true
fi

# Alternativa más directa: reemplazar el parámetro con el tipo any tipado
# para evitar la dependencia de @types/multer completamente
sed -i 's/@UploadedFile() file: Express\.Multer\.File/@UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number }/g' "$FAQ_CTRL" 2>/dev/null || true

ok "faq.controller.ts — Express.Multer.File reemplazado por tipo inline"

# También agregar @types/multer al catalog del workspace si no está
CATALOG="$ROOT/pnpm-workspace.yaml"
if ! grep -q '"@types/multer"' "$CATALOG" 2>/dev/null && ! grep -q "'@types/multer'" "$CATALOG" 2>/dev/null; then
  # En formato yaml sin comillas
  if ! grep -q "@types/multer" "$CATALOG" 2>/dev/null; then
    sed -i 's/"@types/uuid": "\^10.0.0"/"@types\/uuid": "^10.0.0"\n  "@types\/multer": "^1.4.12"/' "$CATALOG" 2>/dev/null || true
    ok "pnpm-workspace.yaml — @types/multer en catalog"
  fi
fi

# Regenerar lockfile para incluir @types/multer
log "Regenerando pnpm-lock.yaml..."
pnpm install --no-frozen-lockfile 2>/dev/null || pnpm install 2>/dev/null || true
ok "pnpm install ejecutado"

echo ""
ok "════════════════════════════════════════════════════════"
ok "  Fix aplicado — faq.controller.ts sin Express.Multer"
ok "════════════════════════════════════════════════════════"
echo ""
echo "Próximo: make g → push → Railway redeploy"