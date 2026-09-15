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
