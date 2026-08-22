# Dockerfile — workers-backend
# Railway: Root Directory = /  |  Dockerfile Path = workers-backend/Dockerfile

FROM node:24-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json .npmrc pnpm-lock.yaml ./
COPY packages/proto/package.json       ./packages/proto/package.json
COPY packages/auth-server/package.json ./packages/auth-server/package.json
COPY packages/grpc-client/package.json ./packages/grpc-client/package.json
COPY workers-backend/package.json                 ./workers-backend/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY tsconfig.base.json     ./
COPY packages/proto/        ./packages/proto/
COPY packages/auth-server/  ./packages/auth-server/
COPY packages/grpc-client/  ./packages/grpc-client/
COPY workers-backend/                  ./workers-backend/
RUN pnpm --filter workers-backend build
RUN test -f workers-backend/dist/main.js || \
    (echo "ERROR: workers-backend/dist/main.js no generado" && exit 1)

FROM node:24-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3004

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/node_modules      ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/workers-backend/dist         ./workers-backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/workers-backend/prisma       ./workers-backend/prisma
COPY --from=builder --chown=nestjs:nodejs /app/workers-backend/package.json ./workers-backend/package.json
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto ./packages/proto/proto

WORKDIR /app/workers-backend
USER nestjs
EXPOSE 3004 5005
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && node dist/main"]
