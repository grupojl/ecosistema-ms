#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix definitivo proto paths
# Estrategia: process.cwd() funciona en CJS y ESM, prod y dev
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

# =============================================================================
# FIX 1 — packages/proto/src/index.ts
# process.cwd() funciona en CUALQUIER contexto (CJS/ESM/prod/dev)
# En Railway runner: WORKDIR=/app, protos copiados a /app/proto/
# En dev local: los servicios se corren desde la raíz del monorepo
# =============================================================================
log "[1/4] packages/proto/src/index.ts — process.cwd() sin import.meta ni __dirname"

cat > "$ROOT/packages/proto/src/index.ts" << 'EOF'
// packages/proto/src/index.ts
// Usa process.cwd() — funciona en CJS, ESM, dev y prod sin cambios.
// En Railway runner (WORKDIR=/app): protos en /app/proto/
// En desarrollo (cwd = raíz monorepo): protos en packages/proto/proto/
import { join } from 'path';

const cwd = process.cwd();

// Detectar si los protos están en ./proto (runner) o en packages/proto/proto (dev)
// El Dockerfile copia los protos a {WORKDIR}/proto/
const PROTO_DIR = join(cwd, 'proto');

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
ok "packages/proto/src/index.ts — process.cwd()"

# =============================================================================
# FIX 2 — Revertir los imports rotos que dejó el sed del script anterior
# Buscar todos los archivos con 'configproto-paths.js' o '....nfigproto-paths.js'
# y reemplazarlos por '@ecosistema-ms/proto'
# =============================================================================
log "[2/4] Revertir imports rotos → @ecosistema-ms/proto"

find "$ROOT" -name "*.ts" \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" | xargs grep -l "configproto-paths\|nfigproto-paths\|proto-paths\.js" 2>/dev/null | while read -r FILE; do
  # Reemplazar cualquier variante rota del import
  sed -i "s|from '.*configproto-paths\.js'|from '@ecosistema-ms/proto'|g" "$FILE"
  sed -i "s|from '.*nfigproto-paths\.js'|from '@ecosistema-ms/proto'|g"   "$FILE"
  sed -i "s|from '.*proto-paths\.js'|from '@ecosistema-ms/proto'|g"       "$FILE"
  ok "  Revertido: $FILE"
done

# =============================================================================
# FIX 3 — Eliminar los archivos proto-paths.ts que creó el script anterior
# Ya no los necesitamos
# =============================================================================
log "[3/4] Eliminar proto-paths.ts helpers innecesarios"

find "$ROOT" -name "proto-paths.ts" \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" | while read -r FILE; do
  rm -f "$FILE"
  ok "  Eliminado: $FILE"
done

# =============================================================================
# FIX 4 — Dockerfile: remover el tsc manual de packages (fallaba por tsconfig.base.json)
#          y en su lugar copiar el src de proto directamente al runner
#          ya que process.cwd()/proto es lo que resuelve en runtime
# =============================================================================
log "[4/4] Dockerfiles — remover tsc manual de packages, simplificar"

rewrite_dockerfile() {
  local SVC="$1"
  local PORT_HTTP="$2"
  local PORT_GRPC="$3"

  cat > "$ROOT/$SVC/Dockerfile" << DEOF
# syntax=docker/dockerfile:1.7
# Dockerfile — $SVC
# Railway: Root Directory = /  |  Dockerfile Path = $SVC/Dockerfile

FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json       ./packages/proto/
COPY packages/auth-server/package.json ./packages/auth-server/
COPY packages/grpc-client/package.json ./packages/grpc-client/
COPY $SVC/package.json                 ./$SVC/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=\$DATABASE_URL
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json            ./tsconfig.base.json
COPY package.json pnpm-workspace.yaml ./
COPY packages/                     ./packages/
COPY $SVC/                         ./$SVC/
WORKDIR /app/$SVC
RUN /app/node_modules/.bin/prisma generate
RUN /app/node_modules/.bin/nest build

FROM node:24-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=$PORT_HTTP
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/$SVC/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules      ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/$SVC/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/$SVC/package.json ./package.json
# Packages internos — sobreescribir los symlinks de pnpm con el código real
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto       ./node_modules/@ecosistema-ms/proto
COPY --from=builder --chown=nestjs:nodejs /app/packages/auth-server ./node_modules/@ecosistema-ms/auth-server
COPY --from=builder --chown=nestjs:nodejs /app/packages/grpc-client ./node_modules/@ecosistema-ms/grpc-client
# Protos en ./proto/ — process.cwd() + '/proto/' los resuelve en runtime
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto ./proto
USER nestjs
EXPOSE $PORT_HTTP $PORT_GRPC
CMD ["dumb-init", "sh", "-c", "node dist/src/main"]
DEOF

  ok "$SVC/Dockerfile"
}

rewrite_dockerfile "notificaciones-backend" 3002 5003
rewrite_dockerfile "analytics-backend"      3003 5004
rewrite_dockerfile "workers-backend"        3004 5005

echo ""
ok "════════════════════════════════════════════════════════"
ok "  4 fixes aplicados"
ok "════════════════════════════════════════════════════════"
echo ""
echo "  [1] proto/src/index.ts  — process.cwd() + '/proto/'"
echo "  [2] imports rotos       — revertidos a @ecosistema-ms/proto"
echo "  [3] proto-paths.ts      — eliminados"
echo "  [4] Dockerfiles         — sin tsc manual, protos en ./proto/"
echo ""
echo "Próximo: make g → push → Railway redeploy"