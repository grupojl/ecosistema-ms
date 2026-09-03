# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo ecosistema-ms/

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc* ./
COPY packages/auth-server/package.json  ./packages/auth-server/
COPY packages/grpc-client/package.json  ./packages/grpc-client/
COPY packages/proto/package.json        ./packages/proto/
COPY logistics-backend/package.json     ./logistics-backend/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY package.json pnpm-workspace.yaml ./
COPY logistics-backend/  ./logistics-backend/
COPY packages/           ./packages/
WORKDIR /app/logistics-backend
RUN /app/node_modules/.bin/prisma generate
RUN /app/node_modules/.bin/nest build

FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3005
ENV GRPC_PORT=5006
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/logistics-backend/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules                   ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/logistics-backend/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/logistics-backend/proto        ./proto
COPY --from=builder --chown=nestjs:nodejs /app/logistics-backend/package.json ./package.json
USER nestjs
EXPOSE 3005
EXPOSE 5006
CMD ["dumb-init", "node", "dist/main"]
