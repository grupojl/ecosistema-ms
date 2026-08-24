#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix: @ecosistema-ms/proto no encontrado en runtime
# Los 3 servicios nuevos crashean porque el workspace package no tiene dist/
# Fix: buildear packages en el builder stage y copiarlos al runner
# Ejecutar: bash x.sh   ó   make x
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

# Función que reescribe el Dockerfile de un servicio con el fix de packages
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
# Buildear packages internos primero para que sus dist/ estén disponibles
RUN cd /app/packages/proto       && /app/node_modules/.bin/tsc -p tsconfig.json 2>/dev/null || true
RUN cd /app/packages/auth-server && /app/node_modules/.bin/tsc -p tsconfig.json 2>/dev/null || true
RUN cd /app/packages/grpc-client && /app/node_modules/.bin/tsc -p tsconfig.json 2>/dev/null || true
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
# Copiar packages internos buildeados (resuelve Cannot find module '@ecosistema-ms/proto')
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto       ./node_modules/@ecosistema-ms/proto
COPY --from=builder --chown=nestjs:nodejs /app/packages/auth-server ./node_modules/@ecosistema-ms/auth-server
COPY --from=builder --chown=nestjs:nodejs /app/packages/grpc-client ./node_modules/@ecosistema-ms/grpc-client
# Protos para gRPC en runtime
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto ./proto
USER nestjs
EXPOSE $PORT_HTTP $PORT_GRPC
CMD ["dumb-init", "sh", "-c", "node dist/src/main"]
DEOF

  ok "$SVC/Dockerfile"
}

log "Reescribiendo Dockerfiles — fix @ecosistema-ms packages en runtime..."
log ""

write_dockerfile "notificaciones-backend" 3002 5003
write_dockerfile "analytics-backend"      3003 5004
write_dockerfile "workers-backend"        3004 5005

# chatia y pagos ya funcionan — verificar si tienen el mismo problema
# Si su CMD es "node dist/src/main" está bien, si no tienen el COPY de packages tampoco
for SVC in chatia-backend pasarelapagos-backend; do
  if ! grep -q "node_modules/@ecosistema-ms/proto" "$ROOT/$SVC/Dockerfile" 2>/dev/null; then
    # Agregar el COPY de packages antes del USER nestjs
    sed -i 's|COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto ./proto|COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto ./proto\nCOPY --from=builder --chown=nestjs:nodejs /app/packages/proto       ./node_modules/@ecosistema-ms/proto\nCOPY --from=builder --chown=nestjs:nodejs /app/packages/auth-server ./node_modules/@ecosistema-ms/auth-server\nCOPY --from=builder --chown=nestjs:nodejs /app/packages/grpc-client ./node_modules/@ecosistema-ms/grpc-client|' \
      "$ROOT/$SVC/Dockerfile" 2>/dev/null || true
    ok "$SVC/Dockerfile — COPY de packages agregado"
  fi
done

echo ""
ok "════════════════════════════════════════════════════════"
ok "  Dockerfiles actualizados — fix @ecosistema-ms/proto"
ok "════════════════════════════════════════════════════════"
echo ""
echo "  Problema: @ecosistema-ms/proto es workspace package sin dist/"
echo "  Fix: buildear packages en builder stage y copiar al runner"
echo "       sobreescribiendo node_modules/@ecosistema-ms/* con los buildeados"
echo ""
echo "Próximo: make g → push → Railway redeploy"