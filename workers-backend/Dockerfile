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
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS deps
ARG PNPM_VERSION

RUN apk add --no-cache dumb-init
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json        ./packages/proto/
COPY packages/logger/package.json       ./packages/logger/
COPY packages/auth-server/package.json        ./packages/auth-server/
COPY packages/grpc-client/package.json  ./packages/grpc-client/
COPY workers-backend/package.json       ./workers-backend/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS build
ARG PNPM_VERSION

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY packages/proto/                    ./packages/proto/
COPY packages/logger/                   ./packages/logger/
COPY packages/auth-server/                ./packages/auth-server/
COPY packages/grpc-client/             ./packages/grpc-client/
COPY workers-backend/                   ./workers-backend/

# Packages compartidos → dist (orden de dependencias: proto → auth-server → grpc-client)
# Ref: ADR-020 — los servicios consumen dist/, nunca src/
RUN pnpm --dir packages/logger      build \
 && pnpm --dir packages/proto       build \
 && pnpm --dir packages/auth-server build \
 && pnpm --dir packages/grpc-client build

WORKDIR /app/workers-backend

RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS runtime

RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=nestjs:nodejs /app/node_modules                      ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/workers-backend/dist              ./workers-backend/dist
COPY --from=build --chown=nestjs:nodejs /app/workers-backend/prisma            ./workers-backend/prisma
COPY --from=build --chown=nestjs:nodejs /app/workers-backend/prisma.config.ts ./workers-backend/prisma.config.ts
COPY --from=build --chown=nestjs:nodejs /app/workers-backend/package.json      ./workers-backend/package.json
COPY --from=build --chown=nestjs:nodejs /app/packages/                           ./packages/
COPY --chown=nestjs:nodejs workers-backend/entrypoint.sh                       ./workers-backend/entrypoint.sh

USER nestjs

EXPOSE 3000
EXPOSE 5005

WORKDIR /app/workers-backend

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["dumb-init", "sh", "/app/workers-backend/entrypoint.sh"]
