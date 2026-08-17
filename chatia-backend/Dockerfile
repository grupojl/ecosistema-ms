# Dockerfile — chatia-backend
# Railway: Root Directory = /  |  Dockerfile Path = chatia-backend/Dockerfile

FROM node:24-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages/proto/package.json       ./packages/proto/package.json
COPY packages/auth-server/package.json ./packages/auth-server/package.json
COPY packages/grpc-client/package.json ./packages/grpc-client/package.json
COPY chatia-backend/package.json       ./chatia-backend/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY tsconfig.base.json     ./
COPY packages/proto/        ./packages/proto/
COPY packages/auth-server/  ./packages/auth-server/
COPY packages/grpc-client/  ./packages/grpc-client/
COPY chatia-backend/        ./chatia-backend/
RUN pnpm --filter chatia-backend build
RUN test -f chatia-backend/dist/main.js || \
    (echo "ERROR: dist/main.js no generado" && exit 1)

FROM node:24-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/node_modules                ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/chatia-backend/dist         ./chatia-backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/chatia-backend/prisma       ./chatia-backend/prisma
COPY --from=builder --chown=nestjs:nodejs /app/chatia-backend/package.json ./chatia-backend/package.json
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto        ./packages/proto/proto

WORKDIR /app/chatia-backend
USER nestjs
EXPOSE 3000 5001
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && node dist/main"]
