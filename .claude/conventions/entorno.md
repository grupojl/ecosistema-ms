# Entorno de desarrollo

- SO: Windows + Git Bash
- Node: 24.14.0
- pnpm: 10.30.3
- Deploy: Railway (cada servicio individual)

## CRÍTICO — pnpm catalog

**Los named catalogs NO funcionan en este entorno.**
`catalog:backend`, `catalog:frontend`, etc. → todos dan error.
Usar SIEMPRE un solo `catalog:` default para todo el ecosistema.
Si ves `catalog:algo` en cualquier `package.json` → es un bug, normalizar a `catalog:`.

## Stack canónico

- Backend: NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- Comunicación inter-servicio: gRPC (`@nestjs/microservices` + `@grpc/grpc-js`)
- Auth: Firebase Authentication (client) + Firebase Admin (server)
- Workspace: pnpm 10 workspaces con catalog único

## Paquetes fuera del catalog estándar (específicos de un servicio)

| Paquete | Dónde |
|---|---|
| `groq-sdk` | `chatia-backend` |
| `@langchain/*`, `langgraph` | `chatia-backend` |
| `mercadopago`, `stripe`, `@conekta/node`, etc. | `pasarelapagos-backend` |
| `firebase-admin` | todos los backs |
| `@nestjs/terminus` | todos (healthcheck) |
| `prom-client` | `notificaciones-backend`, `analytics-backend`, `workers-backend` |

## Puertos por servicio (desarrollo local)

| Servicio | HTTP | gRPC |
|---|---|---|
| `chatia-backend` | 3000 | 5001 |
| `pasarelapagos-backend` | 3001 | 5002 |
| `notificaciones-backend` | 3002 | 5003 |
| `analytics-backend` | 3003 | 5004 |
| `workers-backend` | 3004 | 5005 |
| `marketing-backend` | 3005 | 5006 |

## Variables de entorno — marketing-backend

```bash
# ── Plataformas Ad ────────────────────────────────────────────────────────────
META_APP_ID=                   # Meta for Developers → App ID
META_APP_SECRET=               # Meta for Developers → App Secret
GOOGLE_ADS_CLIENT_ID=          # Google Cloud → OAuth 2.0 Client ID
GOOGLE_ADS_CLIENT_SECRET=      # Google Cloud → OAuth 2.0 Client Secret
GOOGLE_ADS_DEVELOPER_TOKEN=    # Google Ads API Center → Developer Token
TIKTOK_APP_ID=                 # TikTok for Business → App ID
TIKTOK_APP_SECRET=             # TikTok for Business → App Secret

# ── Sync config ───────────────────────────────────────────────────────────────
MARKETING_SYNC_INTERVAL_MINUTES=15   # frecuencia de sync de métricas por org
MARKETING_AUTOMATION_INTERVAL_HOURS=1 # frecuencia de evaluación de reglas

# ── Interno (mismo valor que todos los MS) ────────────────────────────────────
INTERNAL_API_KEY=              # igual en todos los servicios + superadmin
MARKETING_GRPC_PORT=5006

# ── Infra ─────────────────────────────────────────────────────────────────────
DATABASE_URL=                  # PostgreSQL dedicado para marketing-backend
REDIS_URL=                     # mismo Redis compartido del ecosistema
NODE_ENV=production
PORT=3005
```

## Paquetes externos específicos de marketing-backend

| Paquete | Propósito |
|---------|-----------|
| `facebook-nodejs-business-sdk` | Meta Ads API |
| `google-ads-api` | Google Ads API v17+ |
| `axios` | TikTok Ads API (sin SDK oficial estable) |
| `opossum` | Circuit breaker (igual que chatia/pagos/notificaciones) |
