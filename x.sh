#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix definitivo: packages/proto/src/index.ts sin paths dinámicos
# El problema: import.meta no funciona en CJS, __dirname no funciona en ESM
# Solución: exportar solo constantes de strings (nombres de package y archivos)
#            y que cada servicio resuelva el path con su propio __dirname
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

# =============================================================================
# FIX 1 — packages/proto/src/index.ts
# Sin paths dinámicos — solo exporta nombres de packages y filenames
# Cada servicio resuelve el path absoluto con path.join(__dirname, 'proto', FILENAME)
# =============================================================================
log "[1/3] packages/proto/src/index.ts — solo constantes, sin path resolution"

cat > "$ROOT/packages/proto/src/index.ts" << 'EOF'
// packages/proto/src/index.ts
// Sin import.meta ni __dirname — incompatibles entre ESM y CJS.
// Los servicios resuelven el path absoluto con path.join(protoDir, PROTO_FILE).
// Ver: cada servicio tiene PROTO_DIR configurado en su app.module o grpc.module.

// Nombres de los archivos .proto
export const CHATIA_PROTO_FILE    = 'chatia.proto';
export const NOTIF_PROTO_FILE     = 'notificaciones.proto';
export const ANALYTICS_PROTO_FILE = 'analytics.proto';
export const WORKERS_PROTO_FILE   = 'workers.proto';
export const PAGOS_PROTO_FILE     = 'pagos.proto';

// Nombres de packages gRPC (campo `package` en cada .proto)
export const CHATIA_PACKAGE    = 'chatia';
export const NOTIF_PACKAGE     = 'notificaciones';
export const ANALYTICS_PACKAGE = 'analytics';
export const WORKERS_PACKAGE   = 'workers';
export const PAGOS_PACKAGE     = 'pagos';
EOF
ok "packages/proto/src/index.ts — solo constantes"

# =============================================================================
# FIX 2 — Actualizar cada servicio para resolver el path de protos con __dirname
# En el runner los .proto files están en /app/proto/ (copiados por el Dockerfile)
# process.cwd() en runtime = /app (WORKDIR del runner)
# =============================================================================
log "[2/3] Actualizar app.module.ts de los 3 servicios — path de protos"

# Función para reemplazar PROTO_PATH imports por la resolución local
update_proto_paths() {
  local SVC="$1"
  local GRPC_FILE="$ROOT/$SVC/src/grpc/grpc.module.ts"

  if [ ! -f "$GRPC_FILE" ]; then
    # Buscar el archivo que registra los gRPC servers
    GRPC_FILE=$(grep -rl "protoPath\|PROTO_PATH\|proto_path" "$ROOT/$SVC/src/" 2>/dev/null | head -1)
    [ -z "$GRPC_FILE" ] && return
  fi

  # Reemplazar imports de CHATIA_PROTO_PATH/NOTIF_PROTO_PATH/etc por path.join
  # El runner tiene los protos en process.cwd() + '/proto/'
  if grep -q "PROTO_PATH\|_PROTO_PATH" "$GRPC_FILE" 2>/dev/null; then
    # Agregar import de path y process si no está
    if ! grep -q "^import.*'path'" "$GRPC_FILE" 2>/dev/null; then
      sed -i "1s|^|import { join } from 'path';\n|" "$GRPC_FILE"
    fi
    ok "$SVC grpc module — usa path.join para protos"
  fi
}

# =============================================================================
# FIX 3 — Crear un helper de paths que funcione tanto en dev como en prod
# Lo ponemos en cada servicio directamente — evita el problema del package
# =============================================================================
log "[3/3] Crear proto-paths helper en cada servicio"

create_proto_helper() {
  local SVC="$1"
  mkdir -p "$ROOT/$SVC/src/config"

  cat > "$ROOT/$SVC/src/config/proto-paths.ts" << 'HELPER'
// src/config/proto-paths.ts
// Resuelve rutas de .proto files compatible con dev y prod (Railway).
// En prod: el Dockerfile copia los protos a /app/proto/ (process.cwd()/proto)
// En dev:  los protos están en packages/proto/proto/ relativo al workspace root
import { join } from 'path';

// En Railway runner: WORKDIR=/app, protos copiados a /app/proto/
// En desarrollo local: los servicios corren desde su carpeta
const isProd = process.env['NODE_ENV'] === 'production';

const PROTO_DIR = isProd
  ? join(process.cwd(), 'proto')          // /app/proto/ en Railway
  : join(__dirname, '..', '..', '..', '..', 'packages', 'proto', 'proto'); // dev

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
HELPER

  ok "$SVC/src/config/proto-paths.ts creado"
}

for SVC in notificaciones-backend analytics-backend workers-backend chatia-backend pasarelapagos-backend; do
  create_proto_helper "$SVC"
done

# =============================================================================
# Actualizar las importaciones en los módulos gRPC de cada servicio
# Reemplazar imports de @ecosistema-ms/proto por el helper local
# =============================================================================
log "Actualizando imports de @ecosistema-ms/proto → ./config/proto-paths.js"

replace_proto_imports() {
  local SVC="$1"
  # Buscar todos los archivos que importan de @ecosistema-ms/proto
  find "$ROOT/$SVC/src" -name "*.ts" -exec grep -l "@ecosistema-ms/proto" {} \; 2>/dev/null | while read -r FILE; do
    # Calcular la ruta relativa al helper desde el archivo
    FILE_DIR=$(dirname "$FILE")
    SRC_DIR="$ROOT/$SVC/src"
    # Calcular depth relativo
    RELATIVE=$(python3 -c "import os; print(os.path.relpath('$SRC_DIR/config/proto-paths', '$FILE_DIR'))" 2>/dev/null || \
               node -e "const path=require('path'); console.log(path.relative('$FILE_DIR', '$SRC_DIR/config/proto-paths'))" 2>/dev/null || \
               echo "../config/proto-paths")

    sed -i "s|from '@ecosistema-ms/proto'|from '${RELATIVE}.js'|g" "$FILE"
    ok "  $FILE — import actualizado"
  done
}

for SVC in notificaciones-backend analytics-backend workers-backend chatia-backend pasarelapagos-backend; do
  replace_proto_imports "$SVC"
done

echo ""
ok "════════════════════════════════════════════════════════"
ok "  Fix definitivo aplicado"
ok "════════════════════════════════════════════════════════"
echo ""
echo "  [1] proto/src/index.ts    — solo constantes de nombres (sin paths)"
echo "  [2] */src/config/proto-paths.ts — helper local por servicio"
echo "  [3] imports actualizados  — @ecosistema-ms/proto → helper local"
echo ""
echo "Próximo: make g → push → Railway redeploy"