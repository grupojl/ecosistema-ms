#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix Dockerfiles: agregar pnpm-lock.yaml al COPY de deps stage
# Ejecutar: bash x.sh   ó   make x
# Sin Python. Entorno: Windows + Git Bash | Node 24 | pnpm 10
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${CYAN}[x]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde la raíz de ecosistema-ms/"; exit 1; }

log "Parcheando Dockerfiles — agregando pnpm-lock.yaml al COPY de deps..."
log ""

# Función que reescribe el Dockerfile de un servicio
patch_dockerfile() {
  local SVC="$1"
  local PORT_HTTP="$2"
  local PORT_GRPC="$3"
  local DOCKERFILE="$ROOT/$SVC/Dockerfile"

  [ -f "$DOCKERFILE" ] || { warn "$SVC/Dockerfile no existe — saltando"; return; }

  cat > "$DOCKERFILE" << DEOF
# Dockerfile — $SVC
# Railway: Root Directory = /  |  Dockerfile Path = $SVC/Dockerfile

FROM node:24-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json .npmrc pnpm-lock.yaml ./
COPY packages/proto/package.json       ./packages/proto/package.json
COPY packages/auth-server/package.json ./packages/auth-server/package.json
COPY packages/grpc-client/package.json ./packages/grpc-client/package.json
COPY $SVC/package.json                 ./$SVC/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY tsconfig.base.json     ./
COPY packages/proto/        ./packages/proto/
COPY packages/auth-server/  ./packages/auth-server/
COPY packages/grpc-client/  ./packages/grpc-client/
COPY $SVC/                  ./$SVC/
RUN pnpm --filter $SVC build
RUN test -f $SVC/dist/main.js || \\
    (echo "ERROR: $SVC/dist/main.js no generado" && exit 1)

FROM node:24-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=$PORT_HTTP

RUN addgroup --system --gid 1001 nodejs \\
 && adduser  --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/node_modules      ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/$SVC/dist         ./$SVC/dist
COPY --from=builder --chown=nestjs:nodejs /app/$SVC/prisma       ./$SVC/prisma
COPY --from=builder --chown=nestjs:nodejs /app/$SVC/package.json ./$SVC/package.json
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto ./packages/proto/proto

WORKDIR /app/$SVC
USER nestjs
EXPOSE $PORT_HTTP $PORT_GRPC
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && node dist/main"]
DEOF

  ok "$SVC/Dockerfile parcheado"
}

# Parchear los 5 servicios
patch_dockerfile "chatia-backend"          3000 5001
patch_dockerfile "pasarelapagos-backend"   3001 5002
patch_dockerfile "notificaciones-backend"  3002 5003
patch_dockerfile "analytics-backend"       3003 5004
patch_dockerfile "workers-backend"         3004 5005

echo ""
ok "════════════════════════════════════════════════════════"
ok "  5 Dockerfiles parcheados"
ok "════════════════════════════════════════════════════════"
echo ""
warn "PRÓXIMOS PASOS:"
warn "  1. make g   → commit + push"
warn "  2. Railway  → redeploy de cada servicio"