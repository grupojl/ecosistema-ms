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
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS deps

RUN apk add --no-cache dumb-init
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
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS build

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
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS runtime

RUN apk add --no-cache dumb-init
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
COPY --chown=nestjs:nodejs analytics-backend/entrypoint.sh                      ./analytics-backend/entrypoint.sh

USER nestjs

EXPOSE 3000
EXPOSE 5004

WORKDIR /app/analytics-backend

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["dumb-init", "/app/analytics-backend/entrypoint.sh"]
