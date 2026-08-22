# syntax=docker/dockerfile:1.7
# Dockerfile — pasarelapagos-backend
# Railway: Root Directory = /  |  Dockerfile Path = pasarelapagos-backend/Dockerfile

FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json       ./packages/proto/
COPY packages/auth-server/package.json ./packages/auth-server/
COPY packages/grpc-client/package.json ./packages/grpc-client/
COPY pasarelapagos-backend/package.json                 ./pasarelapagos-backend/
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
COPY pasarelapagos-backend/                         ./pasarelapagos-backend/
WORKDIR /app/pasarelapagos-backend
RUN /app/node_modules/.bin/prisma generate
RUN /app/node_modules/.bin/nest build
RUN test -f dist/main.js || (echo "ERROR: dist/main.js no generado" && exit 1)

FROM node:24-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/pasarelapagos-backend/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules      ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/pasarelapagos-backend/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/pasarelapagos-backend/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto ./proto
USER nestjs
EXPOSE 3001 5002
CMD ["dumb-init", "sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
