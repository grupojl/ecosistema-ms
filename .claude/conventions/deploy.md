# Convenciones de Deploy — Railway

## Configuración por microservicio en Railway

| Setting | Valor |
|---------|-------|
| Root Directory | `/` (raíz del monorepo — siempre) |
| Dockerfile Path | `{servicio}/Dockerfile` |
| Build Command | (vacío — lo maneja Dockerfile) |
| Health Check Path | `/health` |
| Health Check Timeout | 30s |
| Restart Policy | On Failure, max 3 |

## Orden de deploy recomendado

1. `packages/proto` — si hubo cambios en protos
2. `pasarelapagos-backend` — crítico, deploy primero
3. `notificaciones-backend`
4. `analytics-backend`
5. `workers-backend`
6. `chatia-backend` — depende de los anteriores

## Variables de entorno obligatorias (todas los microservicios)

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
FIREBASE_PROJECT_ID=...
PORT=300X
GRPC_PORT=500X
```

## Variables de entorno de conectividad gRPC (según dependencias)

```bash
# En chatia-backend (consume todos)
PAGOS_GRPC_URL=pasarelapagos-backend.railway.internal:5002
NOTIF_GRPC_URL=notificaciones-backend.railway.internal:5003
ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5004
WORKERS_GRPC_URL=workers-backend.railway.internal:5005
```

## Dockerfile pattern (todos los microservicios)

```dockerfile
# Stage 1: deps (instala solo las deps del servicio)
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/proto/package.json     ./packages/proto/
COPY packages/auth-server/package.json ./packages/auth-server/
COPY packages/grpc-client/package.json ./packages/grpc-client/
COPY {servicio}/package.json         ./{servicio}/
RUN pnpm install --frozen-lockfile --filter {servicio}...

# Stage 2: build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/ ./packages/
COPY {servicio}/ ./{servicio}/
COPY tsconfig.base.json ./
WORKDIR /app/{servicio}
RUN pnpm build

# Stage 3: runner
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/{servicio}/dist ./dist
COPY --from=builder /app/packages/proto/proto ./proto
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main"]
```

## Prisma en Railway
El `start:migrate` script corre `prisma migrate deploy` antes de levantar.
Railway debe usar `start:migrate` como start command en el primer deploy de cada DB.
