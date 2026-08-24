# syntax=docker/dockerfile:1.7
# Dockerfile — notificaciones-backend
# Railway: Root Directory = /  |  Dockerfile Path = notificaciones-backend/Dockerfile

FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json       ./packages/proto/
COPY packages/auth-server/package.json ./packages/auth-server/
COPY packages/grpc-client/package.json ./packages/grpc-client/
COPY notificaciones-backend/package.json                 ./notificaciones-backend/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json            ./tsconfig.base.json
COPY package.json pnpm-workspace.yaml ./
COPY packages/                     ./packages/
COPY notificaciones-backend/                         ./notificaciones-backend/
# Buildear packages internos desde /app donde tsconfig.base.json está disponible
RUN /app/node_modules/.bin/tsc -p packages/proto/tsconfig.json       --outDir packages/proto/dist
RUN /app/node_modules/.bin/tsc -p packages/auth-server/tsconfig.json  --outDir packages/auth-server/dist
RUN /app/node_modules/.bin/tsc -p packages/grpc-client/tsconfig.json  --outDir packages/grpc-client/dist 2>/dev/null || true
# Buildear el servicio
WORKDIR /app/notificaciones-backend
RUN /app/node_modules/.bin/prisma generate
RUN /app/node_modules/.bin/nest build

FROM node:24-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/notificaciones-backend/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules      ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/notificaciones-backend/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/notificaciones-backend/package.json ./package.json
# Packages internos — copiar el dist compilado (no el src)
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/dist       ./node_modules/@ecosistema-ms/proto
COPY --from=builder --chown=nestjs:nodejs /app/packages/auth-server/dist ./node_modules/@ecosistema-ms/auth-server
COPY --from=builder --chown=nestjs:nodejs /app/packages/grpc-client/dist ./node_modules/@ecosistema-ms/grpc-client
# Protos para gRPC runtime — process.cwd() + '/proto/'
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto ./proto
USER nestjs
EXPOSE 3002 5003
CMD ["dumb-init", "sh", "-c", "node dist/src/main"]
