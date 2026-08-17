# Dockerfile — analytics-backend
# Railway: Root Directory = /  |  Dockerfile Path = analytics-backend/Dockerfile
FROM node:24-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app
FROM base AS deps
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages/proto/package.json        ./packages/proto/package.json
COPY packages/auth-server/package.json  ./packages/auth-server/package.json
COPY packages/grpc-client/package.json  ./packages/grpc-client/package.json
COPY analytics-backend/package.json     ./analytics-backend/package.json
RUN pnpm install --frozen-lockfile
FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/proto/        ./packages/proto/
COPY packages/auth-server/  ./packages/auth-server/
COPY packages/grpc-client/  ./packages/grpc-client/
COPY analytics-backend/     ./analytics-backend/
RUN pnpm --filter analytics-backend build
RUN test -f analytics-backend/dist/main.js || (echo "ERROR: dist/main.js no generado" && exit 1)
FROM node:24-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3003
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/node_modules                    ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/analytics-backend/dist          ./analytics-backend/dist
COPY --from=builder --chown=nestjs:nodejs /app/analytics-backend/prisma        ./analytics-backend/prisma
COPY --from=builder --chown=nestjs:nodejs /app/analytics-backend/package.json  ./analytics-backend/package.json
COPY --from=builder --chown=nestjs:nodejs /app/packages/proto/proto             ./packages/proto/proto
WORKDIR /app/analytics-backend
USER nestjs
EXPOSE 3003 5004
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && node dist/main"]
