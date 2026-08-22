#!/usr/bin/env bash
# =============================================================================
# x.sh — Reescribe los 5 Dockerfiles siguiendo el patrón de welver
#         que ya funciona en Railway (sin pnpm --filter, con WORKDIR por servicio)
# Ejecutar: bash x.sh   ó   make x
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

write_dockerfile() {
  local SVC="$1"
  local PORT_HTTP="$2"
  local PORT_GRPC="$3"
  local EXTRA_COPY="${4:-}"   # líneas COPY adicionales opcionales (ej: packages extra)

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
RUN test -f dist/main.js || (echo "ERROR: dist/main.js no generado" && exit 1)

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
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto ./proto
USER nestjs
EXPOSE $PORT_HTTP $PORT_GRPC
CMD ["dumb-init", "sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
DEOF

  ok "$SVC/Dockerfile"
}

log "Reescribiendo Dockerfiles con patrón welver..."
log ""

write_dockerfile "chatia-backend"         3000 5001
write_dockerfile "pasarelapagos-backend"  3001 5002
write_dockerfile "notificaciones-backend" 3002 5003
write_dockerfile "analytics-backend"      3003 5004
write_dockerfile "workers-backend"        3004 5005

echo ""
ok "════════════════════════════════════════════════════════"
ok "  5 Dockerfiles reescritos — patrón welver"
ok "════════════════════════════════════════════════════════"
echo ""
echo "  - pnpm install en deps stage con --ignore-scripts"
echo "  - WORKDIR /app/{servicio} en builder"
echo "  - prisma generate y nest build con binarios directos"
echo "  - Sin pnpm --filter"
echo ""
echo "Próximo paso: make g → push → Railway redeploy"