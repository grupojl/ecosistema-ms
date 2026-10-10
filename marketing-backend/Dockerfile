# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (ecosistema-ms/)
# Railway  → Root Directory: /  |  Dockerfile Path: marketing-backend/Dockerfile
# VPS/AWS  → docker build -f marketing-backend/Dockerfile .
#
# HTTP:  3015 (REST público + /internal/* para superadmin)
# gRPC:  5015 (red privada Railway)
# BullMQ: campaign-sync, campaign-automation, marketing-attribution + DLQs
# Scheduler: cron jobs via @nestjs/schedule
# Ref: .claude/architecture/05-dockerfile-backend.md
# Ref: .claude/architecture/norte-marketing.md

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
COPY marketing-backend/package.json     ./marketing-backend/

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
COPY marketing-backend/                 ./marketing-backend/

# node_modules de cada workspace (symlinks + .bin: tsc, prisma, nest) — el install de deps los genera
COPY --from=deps /app/packages/proto/node_modules        ./packages/proto/node_modules
COPY --from=deps /app/packages/logger/node_modules       ./packages/logger/node_modules
COPY --from=deps /app/packages/auth-server/node_modules  ./packages/auth-server/node_modules
COPY --from=deps /app/packages/grpc-client/node_modules  ./packages/grpc-client/node_modules
COPY --from=deps /app/marketing-backend/node_modules            ./marketing-backend/node_modules

# Packages compartidos → dist (orden de dependencias: proto → auth-server → grpc-client)
# Ref: ADR-020 — los servicios consumen dist/, nunca src/
RUN pnpm --dir packages/logger      build \
 && pnpm --dir packages/proto       build \
 && pnpm --dir packages/auth-server build \
 && pnpm --dir packages/grpc-client build

WORKDIR /app/marketing-backend

RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS runtime

RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3015

COPY --from=build --chown=nestjs:nodejs /app/node_modules                       ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/marketing-backend/dist             ./marketing-backend/dist
COPY --from=build --chown=nestjs:nodejs /app/marketing-backend/prisma           ./marketing-backend/prisma
COPY --from=build --chown=nestjs:nodejs /app/marketing-backend/prisma.config.ts ./marketing-backend/prisma.config.ts
COPY --from=build --chown=nestjs:nodejs /app/marketing-backend/package.json     ./marketing-backend/package.json
COPY --from=build --chown=nestjs:nodejs /app/packages/                           ./packages/
COPY --chown=nestjs:nodejs marketing-backend/entrypoint.sh                      ./marketing-backend/entrypoint.sh

USER nestjs

EXPOSE 3015
EXPOSE 5015

WORKDIR /app/marketing-backend

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3015/health || exit 1

CMD ["dumb-init", "sh", "/app/marketing-backend/entrypoint.sh"]
