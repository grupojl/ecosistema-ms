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
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS deps

RUN apk add --no-cache dumb-init
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
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS build

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
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS runtime

RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=nestjs:nodejs /app/node_modules                    ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/chatia-backend/dist             ./chatia-backend/dist
COPY --from=build --chown=nestjs:nodejs /app/chatia-backend/prisma           ./chatia-backend/prisma
COPY --from=build --chown=nestjs:nodejs /app/chatia-backend/package.json     ./chatia-backend/package.json
COPY --from=build --chown=nestjs:nodejs /app/packages/proto/                 ./packages/proto/
COPY --chown=nestjs:nodejs chatia-backend/entrypoint.sh                      ./chatia-backend/entrypoint.sh

USER nestjs

EXPOSE 3000
EXPOSE 5001

WORKDIR /app/chatia-backend

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["dumb-init", "/app/chatia-backend/entrypoint.sh"]
