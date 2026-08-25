#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

log "Fix 1: eliminar import @ecosistema-ms/auth-server de health controllers"

for SVC in notificaciones-backend analytics-backend workers-backend; do
  FILE="$ROOT/$SVC/src/health/health.controller.ts"
  [ -f "$FILE" ] || continue
  sed -i "/from '@ecosistema-ms\/auth-server'/d" "$FILE"
  if grep -q "@Public()" "$FILE" 2>/dev/null; then
    sed -i "1s|^|import { SetMetadata } from '@nestjs/common';\nconst Public = () => SetMetadata('isPublic', true);\n|" "$FILE"
  fi
  ok "$SVC health.controller.ts"
done

log "Fix 2: Dockerfiles idénticos a chatia — sin COPY de packages al runner"

write_dockerfile() {
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
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto ./proto
USER nestjs
EXPOSE $PORT_HTTP $PORT_GRPC
CMD ["dumb-init", "sh", "-c", "node dist/src/main"]
DEOF
  ok "$SVC/Dockerfile"
}

write_dockerfile "notificaciones-backend" 3002 5003
write_dockerfile "analytics-backend"      3003 5004
write_dockerfile "workers-backend"        3004 5005

echo ""
ok "════════════════════════════════════════════════════════"
ok "  Fix completo — igual que chatia"
ok "════════════════════════════════════════════════════════"
echo ""
echo "Próximo: make g → push → Railway redeploy"