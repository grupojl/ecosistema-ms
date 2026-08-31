# Entorno de Desarrollo

## Requisitos
- Node 24.14.0 (usar nvm o fnm)
- pnpm 10.30.3 (`corepack enable && corepack prepare pnpm@10.30.3 --activate`)
- Docker Desktop (para PostgreSQL y Redis locales)
- Git Bash (Windows) o bash nativo (Mac/Linux)

## Setup inicial

```bash
# 1. Instalar deps del monorepo completo
pnpm install

# 2. Levantar infra local
docker compose up -d   # PostgreSQL + Redis

# 3. Por microservicio: migrar y levantar
cd chatia-backend
cp .env.example .env   # completar con valores locales
pnpm prisma:migrate:dev
pnpm start:dev
```

## Puertos locales

| Servicio | HTTP | gRPC |
|----------|------|------|
| chatia-backend | 3000 | 5001 |
| pasarelapagos-backend | 3001 | 5002 |
| notificaciones-backend | 3002 | 5003 |
| analytics-backend | 3003 | 5004 |
| workers-backend | 3004 | 5005 |

## CRÍTICO — pnpm catalog
Named catalogs (`catalog:algo`) no funcionan en este entorno.
Siempre usar `catalog:` (default).

Verificar antes de agregar dependencias:
```bash
# ✅ Correcto
"@nestjs/common": "catalog:"

# ❌ Error — named catalog
"@nestjs/common": "catalog:backend"
```

## Variables de entorno — desarrollo local

Usar `localhost` para gRPC URLs:
```bash
CHATIA_GRPC_URL=localhost:5001
PAGOS_GRPC_URL=localhost:5002
NOTIF_GRPC_URL=localhost:5003
ANALYTICS_GRPC_URL=localhost:5004
WORKERS_GRPC_URL=localhost:5005
```
