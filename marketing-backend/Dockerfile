# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (ecosistema-ms/)
# Railway  → Root Directory: /  |  Dockerfile Path: marketing-backend/Dockerfile
# VPS/AWS  → docker build -f marketing-backend/Dockerfile .
#
# HTTP:  3005 (REST público + /internal/* para superadmin)
# gRPC:  5006 (red privada Railway)
# BullMQ: campaign-sync, campaign-automation, marketing-attribution + DLQs
# Scheduler: cron jobs via @nestjs/schedule
# Ref: .claude/architecture/05-dockerfile-backend.md
# Ref: .claude/architecture/norte-marketing.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS deps

RUN apk add --no-cache dumb-init
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json        ./packages/proto/
COPY packages/grpc-client/package.json  ./packages/grpc-client/
COPY marketing-backend/package.json     ./marketing-backend/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-marketing,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY packages/proto/                    ./packages/proto/
COPY packages/grpc-client/             ./packages/grpc-client/
COPY marketing-backend/                 ./marketing-backend/

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
ENV PORT=3005

COPY --from=build --chown=nestjs:nodejs /app/node_modules                       ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/marketing-backend/dist             ./marketing-backend/dist
COPY --from=build --chown=nestjs:nodejs /app/marketing-backend/prisma           ./marketing-backend/prisma
COPY --from=build --chown=nestjs:nodejs /app/marketing-backend/package.json     ./marketing-backend/package.json
COPY --from=build --chown=nestjs:nodejs /app/packages/proto/                    ./packages/proto/
COPY --chown=nestjs:nodejs marketing-backend/entrypoint.sh                      ./marketing-backend/entrypoint.sh

USER nestjs

EXPOSE 3005
EXPOSE 5006

WORKDIR /app/marketing-backend

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3005/health || exit 1

CMD ["dumb-init", "/app/marketing-backend/entrypoint.sh"]
