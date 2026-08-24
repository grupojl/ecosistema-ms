#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix: buildear packages internos en el builder stage
# auth-server/src/*.ts no compila en runtime — necesita dist/
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

log "Fix: buildear packages internos con tsc desde /app (donde está tsconfig.base.json)"

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
# Buildear packages internos desde /app donde tsconfig.base.json está disponible
RUN /app/node_modules/.bin/tsc -p packages/proto/tsconfig.json       --outDir packages/proto/dist
RUN /app/node_modules/.bin/tsc -p packages/auth-server/tsconfig.json  --outDir packages/auth-server/dist
RUN /app/node_modules/.bin/tsc -p packages/grpc-client/tsconfig.json  --outDir packages/grpc-client/dist 2>/dev/null || true
# Buildear el servicio
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
# Packages internos — copiar el dist compilado (no el src)
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/dist       ./node_modules/@ecosistema-ms/proto
COPY --from=builder --chown=nestjs:nodejs /app/packages/auth-server/dist ./node_modules/@ecosistema-ms/auth-server
COPY --from=builder --chown=nestjs:nodejs /app/packages/grpc-client/dist ./node_modules/@ecosistema-ms/grpc-client
# Protos para gRPC runtime — process.cwd() + '/proto/'
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
ok "  Dockerfiles actualizados"
ok "════════════════════════════════════════════════════════"
echo ""
echo "  builder: tsc compila packages/ desde /app (donde está tsconfig.base.json)"
echo "  runner:  copia packages/*/dist/ → node_modules/@ecosistema-ms/*"
echo ""
echo "Próximo: make g → push → Railway redeploy"