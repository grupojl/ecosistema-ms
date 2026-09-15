#!/usr/bin/env bash
# x.sh — ecosistema-ms
# Genera: Dockerfile + .dockerignore para los 5 microservicios
#
# Uso:    bash x.sh          (desde la raíz del monorepo ecosistema-ms/)
# Make:   make x
#
# Archivos que genera:
#   chatia-backend/Dockerfile
#   chatia-backend/.dockerignore
#   pasarelapagos-backend/Dockerfile
#   pasarelapagos-backend/.dockerignore
#   notificaciones-backend/Dockerfile
#   notificaciones-backend/.dockerignore
#   analytics-backend/Dockerfile
#   analytics-backend/.dockerignore
#   workers-backend/Dockerfile
#   workers-backend/.dockerignore
#
# Diferencias por servicio:
#   chatia-backend       → HTTP 3000 | gRPC 5001 | BullMQ (incoming, outgoing, faq-ingestion)
#   pasarelapagos-backend → HTTP 3001 | gRPC 5002 | BullMQ (reconcile, webhook, dlq)
#   notificaciones-backend → HTTP 3000 | gRPC 5003 | BullMQ (notification)
#   analytics-backend    → HTTP 3000 | gRPC 5004 | BullMQ (analytics-events)
#   workers-backend      → HTTP 3000 | gRPC 5005 | BullMQ (5 queues + DLQs)
#
# Todos comparten:
#   - packages/proto/      → archivos .proto necesarios en runtime para gRPC server
#   - packages/auth-server/ → guards y decorators compartidos
#   - packages/grpc-client/ → módulos NestJS de clientes gRPC
#
# Referencias:
#   .claude/architecture/05-dockerfile-backend.md
#   .claude/architecture/07-railway-deploy.md
#   .claude/architecture/02-comunicacion-grpc.md

set -euo pipefail

# ── colores ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✔${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✖${NC}  $*"; exit 1; }

# ── guardia: ejecutar desde la raíz del monorepo ─────────────────────────────
[[ -f "pnpm-workspace.yaml" ]]         || err "Ejecutar desde la raíz del monorepo"
[[ -d "chatia-backend" ]]              || err "No se encontró chatia-backend/"
[[ -d "pasarelapagos-backend" ]]       || err "No se encontró pasarelapagos-backend/"
[[ -d "notificaciones-backend" ]]      || err "No se encontró notificaciones-backend/"
[[ -d "analytics-backend" ]]           || err "No se encontró analytics-backend/"
[[ -d "workers-backend" ]]             || err "No se encontró workers-backend/"
[[ -d "packages/proto" ]]              || err "No se encontró packages/proto/"
[[ -d "packages/auth-server" ]]        || err "No se encontró packages/auth-server/"
[[ -d "packages/grpc-client" ]]        || err "No se encontró packages/grpc-client/"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  x.sh — ecosistema-ms Dockerfiles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── función auxiliar: .dockerignore canónico (igual para todos) ───────────────
write_dockerignore() {
  local SERVICE_DIR="$1"
  cat > "${SERVICE_DIR}/.dockerignore" << 'EOF'
node_modules
dist
coverage
.env
.env.*
*.log
*.tsbuildinfo
prisma/migrations
prisma/seed.ts
generated
EOF
  ok "${SERVICE_DIR}/.dockerignore"
}

# ══════════════════════════════════════════════════════════════════════════════
# 1. chatia-backend
#    HTTP: 3000 | gRPC: 5001
#    BullMQ: incoming-messages, outgoing-messages, faq-ingestion
#    Packages: auth-server, grpc-client, proto
# ══════════════════════════════════════════════════════════════════════════════
cat > chatia-backend/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (ecosistema-ms/)
# Railway  → Root Directory: /  |  Dockerfile Path: chatia-backend/Dockerfile
# VPS/AWS  → docker build -f chatia-backend/Dockerfile .
#
# HTTP:  3000 (público — REST + WebSocket)
# gRPC:  5001 (interno — red privada Railway)
# BullMQ: incoming-messages, outgoing-messages, faq-ingestion
# Ref: .claude/architecture/05-dockerfile-backend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json        ./packages/proto/
COPY packages/auth-server/package.json  ./packages/auth-server/
COPY packages/grpc-client/package.json  ./packages/grpc-client/
COPY chatia-backend/package.json        ./chatia-backend/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-chatia,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY packages/proto/                    ./packages/proto/
COPY packages/auth-server/              ./packages/auth-server/
COPY packages/grpc-client/              ./packages/grpc-client/
COPY chatia-backend/                    ./chatia-backend/

WORKDIR /app/chatia-backend

RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=nestjs:nodejs /app/node_modules                    ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/chatia-backend/dist             ./chatia-backend/dist
COPY --from=build --chown=nestjs:nodejs /app/chatia-backend/prisma           ./chatia-backend/prisma
COPY --from=build --chown=nestjs:nodejs /app/chatia-backend/package.json     ./chatia-backend/package.json
# .proto files requeridos en runtime para levantar el servidor gRPC (5001)
# @nestjs/microservices los lee desde el path absoluto en packages/proto/proto/
COPY --from=build --chown=nestjs:nodejs /app/packages/proto/                 ./packages/proto/

USER nestjs

# HTTP (público) + gRPC (solo red privada — no exponer al exterior)
EXPOSE 3000
EXPOSE 5001

WORKDIR /app/chatia-backend

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
EOF
ok "chatia-backend/Dockerfile"
write_dockerignore "chatia-backend"

# ══════════════════════════════════════════════════════════════════════════════
# 2. pasarelapagos-backend
#    HTTP: 3001 | gRPC: 5002
#    BullMQ: reconcile-payments, webhook-processing, dlq-payments
#    Packages: auth-server, grpc-client, proto
#    Extra: PiiService (AES-256-GCM) → PII_ENCRYPTION_KEY requerida en producción
# ══════════════════════════════════════════════════════════════════════════════
cat > pasarelapagos-backend/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (ecosistema-ms/)
# Railway  → Root Directory: /  |  Dockerfile Path: pasarelapagos-backend/Dockerfile
# VPS/AWS  → docker build -f pasarelapagos-backend/Dockerfile .
#
# HTTP:  3001 (público — REST pagos, webhooks de providers)
# gRPC:  5002 (interno — red privada Railway)
# BullMQ: reconcile-payments, webhook-processing, dlq-payments
# IMPORTANTE: PII_ENCRYPTION_KEY (32 bytes hex) requerida en producción
# Ref: .claude/architecture/05-dockerfile-backend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json              ./packages/proto/
COPY packages/auth-server/package.json        ./packages/auth-server/
COPY packages/grpc-client/package.json        ./packages/grpc-client/
COPY pasarelapagos-backend/package.json       ./pasarelapagos-backend/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-pasarela,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules        ./node_modules
COPY tsconfig.base.json                   ./
COPY packages/proto/                      ./packages/proto/
COPY packages/auth-server/                ./packages/auth-server/
COPY packages/grpc-client/               ./packages/grpc-client/
COPY pasarelapagos-backend/               ./pasarelapagos-backend/

WORKDIR /app/pasarelapagos-backend

RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production
# Puerto distinto al resto — evita conflicto si se levantan varios MS en el mismo host
ENV PORT=3001

COPY --from=build --chown=nestjs:nodejs /app/node_modules                          ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/pasarelapagos-backend/dist            ./pasarelapagos-backend/dist
COPY --from=build --chown=nestjs:nodejs /app/pasarelapagos-backend/prisma          ./pasarelapagos-backend/prisma
COPY --from=build --chown=nestjs:nodejs /app/pasarelapagos-backend/package.json    ./pasarelapagos-backend/package.json
COPY --from=build --chown=nestjs:nodejs /app/packages/proto/                       ./packages/proto/

USER nestjs

# HTTP (público — webhooks de MercadoPago/Stripe llegan aquí) + gRPC (privado)
EXPOSE 3001
EXPOSE 5002

WORKDIR /app/pasarelapagos-backend

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/main.js"]
EOF
ok "pasarelapagos-backend/Dockerfile"
write_dockerignore "pasarelapagos-backend"

# ══════════════════════════════════════════════════════════════════════════════
# 3. notificaciones-backend
#    HTTP: 3000 | gRPC: 5003
#    BullMQ: notification (con dedup + DLQ monitor)
#    Packages: auth-server, grpc-client, proto
# ══════════════════════════════════════════════════════════════════════════════
cat > notificaciones-backend/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (ecosistema-ms/)
# Railway  → Root Directory: /  |  Dockerfile Path: notificaciones-backend/Dockerfile
# VPS/AWS  → docker build -f notificaciones-backend/Dockerfile .
#
# HTTP:  3000 (público — REST preferencias)
# gRPC:  5003 (interno — red privada Railway)
# BullMQ: notification-queue (con idempotency check + DLQ monitor)
# Ref: .claude/architecture/05-dockerfile-backend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json              ./packages/proto/
COPY packages/auth-server/package.json        ./packages/auth-server/
COPY packages/grpc-client/package.json        ./packages/grpc-client/
COPY notificaciones-backend/package.json      ./notificaciones-backend/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-notif,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules        ./node_modules
COPY tsconfig.base.json                   ./
COPY packages/proto/                      ./packages/proto/
COPY packages/auth-server/                ./packages/auth-server/
COPY packages/grpc-client/               ./packages/grpc-client/
COPY notificaciones-backend/              ./notificaciones-backend/

WORKDIR /app/notificaciones-backend

RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=nestjs:nodejs /app/node_modules                           ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/notificaciones-backend/dist            ./notificaciones-backend/dist
COPY --from=build --chown=nestjs:nodejs /app/notificaciones-backend/prisma          ./notificaciones-backend/prisma
COPY --from=build --chown=nestjs:nodejs /app/notificaciones-backend/package.json    ./notificaciones-backend/package.json
COPY --from=build --chown=nestjs:nodejs /app/packages/proto/                        ./packages/proto/

USER nestjs

EXPOSE 3000
EXPOSE 5003

WORKDIR /app/notificaciones-backend

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
EOF
ok "notificaciones-backend/Dockerfile"
write_dockerignore "notificaciones-backend"

# ══════════════════════════════════════════════════════════════════════════════
# 4. analytics-backend
#    HTTP: 3000 | gRPC: 5004
#    BullMQ: analytics-events (best-effort, 1 intento — ADR fire-and-forget)
#    Packages: grpc-client, proto (NO auth-server — solo consumido internamente)
#    Extra: SSE endpoint para streaming de eventos en tiempo real
# ══════════════════════════════════════════════════════════════════════════════
cat > analytics-backend/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (ecosistema-ms/)
# Railway  → Root Directory: /  |  Dockerfile Path: analytics-backend/Dockerfile
# VPS/AWS  → docker build -f analytics-backend/Dockerfile .
#
# HTTP:  3000 (interno — REST analytics + SSE /sse/events)
# gRPC:  5004 (interno — red privada Railway)
# BullMQ: analytics-events (best-effort, attempts:1, fire-and-forget)
# NOTA: analytics-backend no usa auth-server — solo lo consumen otros MS vía gRPC
# Ref: .claude/architecture/05-dockerfile-backend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json        ./packages/proto/
COPY packages/grpc-client/package.json  ./packages/grpc-client/
COPY analytics-backend/package.json     ./analytics-backend/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-analytics,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY packages/proto/                    ./packages/proto/
COPY packages/grpc-client/             ./packages/grpc-client/
COPY analytics-backend/                 ./analytics-backend/

WORKDIR /app/analytics-backend

RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=nestjs:nodejs /app/node_modules                       ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/analytics-backend/dist             ./analytics-backend/dist
COPY --from=build --chown=nestjs:nodejs /app/analytics-backend/prisma           ./analytics-backend/prisma
COPY --from=build --chown=nestjs:nodejs /app/analytics-backend/package.json     ./analytics-backend/package.json
COPY --from=build --chown=nestjs:nodejs /app/packages/proto/                    ./packages/proto/

USER nestjs

EXPOSE 3000
EXPOSE 5004

WORKDIR /app/analytics-backend

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
EOF
ok "analytics-backend/Dockerfile"
write_dockerignore "analytics-backend"

# ══════════════════════════════════════════════════════════════════════════════
# 5. workers-backend
#    HTTP: 3000 | gRPC: 5005
#    BullMQ: faq-ingest, vector-index, campaign-email, analytics-export
#            + DLQs de cada una (5 queues principales + 3 DLQs)
#    Packages: grpc-client, proto (cliente de chatia, notif, analytics)
#    Extra: scheduler con lock Redis distribuido (SET NX EX) — ADR-006
# ══════════════════════════════════════════════════════════════════════════════
cat > workers-backend/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (ecosistema-ms/)
# Railway  → Root Directory: /  |  Dockerfile Path: workers-backend/Dockerfile
# VPS/AWS  → docker build -f workers-backend/Dockerfile .
#
# HTTP:  3000 (interno — REST jobs/stats, DLQ management)
# gRPC:  5005 (interno — red privada Railway)
# BullMQ: faq-ingest, vector-index, campaign-email, analytics-export + DLQs
# Scheduler: lock Redis distribuido (SET NX EX) — ADR-006
# gRPC clients: chatia (5001), notificaciones (5003), analytics (5004)
# Ref: .claude/architecture/05-dockerfile-backend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json        ./packages/proto/
COPY packages/grpc-client/package.json  ./packages/grpc-client/
COPY workers-backend/package.json       ./workers-backend/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-workers,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY packages/proto/                    ./packages/proto/
COPY packages/grpc-client/             ./packages/grpc-client/
COPY workers-backend/                   ./workers-backend/

WORKDIR /app/workers-backend

RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=nestjs:nodejs /app/node_modules                      ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/workers-backend/dist              ./workers-backend/dist
COPY --from=build --chown=nestjs:nodejs /app/workers-backend/prisma            ./workers-backend/prisma
COPY --from=build --chown=nestjs:nodejs /app/workers-backend/package.json      ./workers-backend/package.json
# proto/ requerido en runtime — workers llama a chatia (5001), notif (5003) y analytics (5004) vía gRPC
COPY --from=build --chown=nestjs:nodejs /app/packages/proto/                   ./packages/proto/

USER nestjs

EXPOSE 3000
EXPOSE 5005

WORKDIR /app/workers-backend

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
EOF
ok "workers-backend/Dockerfile"
write_dockerignore "workers-backend"

# ══════════════════════════════════════════════════════════════════════════════
# Resumen
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Archivos generados"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
printf "  %-30s %s\n" "Servicio"              "HTTP  gRPC"
printf "  %-30s %s\n" "──────────────────────────────" "────  ────"
printf "  %-30s %s\n" "chatia-backend"         "3000  5001"
printf "  %-30s %s\n" "pasarelapagos-backend"  "3001  5002"
printf "  %-30s %s\n" "notificaciones-backend" "3000  5003"
printf "  %-30s %s\n" "analytics-backend"      "3000  5004"
printf "  %-30s %s\n" "workers-backend"        "3000  5005"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Configuración Railway por servicio"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
for svc in chatia-backend pasarelapagos-backend notificaciones-backend analytics-backend workers-backend; do
  echo "  ${svc}:"
  echo "    Root Directory:  /"
  echo "    Dockerfile Path: ${svc}/Dockerfile"
  echo "    Build Command:   (vacío)"
  echo "    Start Command:   (vacío)"
  echo "    Health check:    GET /health"
  echo ""
done
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Variables de entorno gRPC (red privada Railway)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  CHATIA_GRPC_URL=chatia-backend.railway.internal:5001"
echo "  PAGOS_GRPC_URL=pasarelapagos-backend.railway.internal:5002"
echo "  NOTIF_GRPC_URL=notificaciones-backend.railway.internal:5003"
echo "  ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5004"
echo "  WORKERS_GRPC_URL=workers-backend.railway.internal:5005"
echo ""
echo "  En local:"
echo "  CHATIA_GRPC_URL=localhost:5001"
echo "  PAGOS_GRPC_URL=localhost:5002"
echo "  NOTIF_GRPC_URL=localhost:5003"
echo "  ANALYTICS_GRPC_URL=localhost:5004"
echo "  WORKERS_GRPC_URL=localhost:5005"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
warn "pasarelapagos-backend: configurar PII_ENCRYPTION_KEY en producción (32 bytes hex)"
warn "analytics-backend:     no usa auth-server — solo consumido vía gRPC internamente"
echo ""