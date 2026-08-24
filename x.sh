#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix: __dirname no existe en ESM — packages/proto/src/index.ts
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

log "Fix: packages/proto/src/index.ts — __dirname → import.meta.url (ESM)"

cat > "$ROOT/packages/proto/src/index.ts" << 'EOF'
// packages/proto/src/index.ts
// ESM — module:nodenext → usar import.meta.url, NO __dirname
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// En runtime el proto package se copia a node_modules/@ecosistema-ms/proto/
// Los .proto files están en ./proto/ relativo al package
const PROTO_DIR = join(__dirname, '..', 'proto');

export const CHATIA_PROTO_PATH    = join(PROTO_DIR, 'chatia.proto');
export const NOTIF_PROTO_PATH     = join(PROTO_DIR, 'notificaciones.proto');
export const ANALYTICS_PROTO_PATH = join(PROTO_DIR, 'analytics.proto');
export const WORKERS_PROTO_PATH   = join(PROTO_DIR, 'workers.proto');
export const PAGOS_PROTO_PATH     = join(PROTO_DIR, 'pagos.proto');

export const CHATIA_PACKAGE    = 'chatia';
export const NOTIF_PACKAGE     = 'notificaciones';
export const ANALYTICS_PACKAGE = 'analytics';
export const WORKERS_PACKAGE   = 'workers';
export const PAGOS_PACKAGE     = 'pagos';
EOF
ok "packages/proto/src/index.ts — usa import.meta.url"

echo ""
ok "═══════════════════════════════════════════════════════"
ok "  Fix aplicado"
ok "═══════════════════════════════════════════════════════"
echo ""
echo "Próximo: make g → push → Railway redeploy"