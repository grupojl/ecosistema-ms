# syntax=docker/dockerfile:1.7
# Dockerfile — workers-backend
# Railway: Root Directory = /  |  Dockerfile Path = workers-backend/Dockerfile

FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json       ./packages/proto/
COPY packages/auth-server/package.json ./packages/auth-server/
COPY packages/grpc-client/package.json ./packages/grpc-client/
COPY workers-backend/package.json                 ./workers-backend/
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
COPY workers-backend/                         ./workers-backend/
# Buildear packages internos primero para que sus dist/ estén disponibles
RUN cd /app/packages/proto       && /app/node_modules/.bin/tsc -p tsconfig.json 2>/dev/null || true
RUN cd /app/packages/auth-server && /app/node_modules/.bin/tsc -p tsconfig.json 2>/dev/null || true
RUN cd /app/packages/grpc-client && /app/node_modules/.bin/tsc -p tsconfig.json 2>/dev/null || true
# Buildear el servicio
WORKDIR /app/workers-backend
RUN /app/node_modules/.bin/prisma generate
RUN /app/node_modules/.bin/nest build

FROM node:24-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3004
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/workers-backend/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules      ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/workers-backend/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/workers-backend/package.json ./package.json
# Copiar packages internos buildeados (resuelve Cannot find module '@ecosistema-ms/proto')
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto       ./node_modules/@ecosistema-ms/proto
COPY --from=builder --chown=nestjs:nodejs /app/packages/auth-server ./node_modules/@ecosistema-ms/auth-server
COPY --from=builder --chown=nestjs:nodejs /app/packages/grpc-client ./node_modules/@ecosistema-ms/grpc-client
# Protos para gRPC en runtime
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto ./proto
USER nestjs
EXPOSE 3004 5005
CMD ["dumb-init", "sh", "-c", "node dist/src/main"]
