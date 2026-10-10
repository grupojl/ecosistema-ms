# Puertos locales — grupojl-control (Super Admin)

Cada repo del ecosistema tiene un rango propio para que no se pisen al correr todo en local.

## Rangos

| Repo | Rango | Estado |
|------|-------|--------|
| superadmin (grupojl-control) | 3000–3009 | en uso |
| ecosistema-ms | 3010–3019 | asignado |
| ecosistema (welver) | 3020–3029 | asignado |

## Superadmin (3000–3009)

| Servicio | Puerto | Variable / config |
|----------|--------|-------------------|
| grupojl-control-frontend (Next.js) | 3000 | `next dev -p 3000` |
| grupojl-control-backend (NestJS) | 3001 | `PORT=3001` |
| (libres) | 3002–3009 | reservados para nuevos servicios del superadmin |

El frontend llama al backend con `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001`.
El backend permite CORS desde `ALLOWED_ORIGINS=http://localhost:3000`.

# Puertos del monorepo ecosistema-ms

## Reparto entre ecosistemas (HTTP)

| Ecosistema | Rango |
|---|---|
| superadmin | 3000 – 3010 |
| **ecosistema-ms** | **3010 – 3020** |
| ecosistema | 3020 – 3030 |

El rango HTTP 3010–3020 solo tiene 10 puertos y este monorepo necesita 12 (6 servicios × HTTP + gRPC). Por eso el gRPC va en una familia aparte, **5010–5015**, siempre HTTP + 2000.

## Puertos por servicio

| Servicio | HTTP | gRPC | Acceso |
|---|---|---|---|
| chatia-backend | 3010 | 5010 | HTTP público (REST + WebSocket) |
| pasarelapagos-backend | 3011 | 5011 | HTTP público (REST + webhooks de proveedores) |
| analytics-backend | 3012 | 5012 | HTTP interno (REST + SSE `/sse/events`) |
| notificaciones-backend | 3013 | 5013 | HTTP interno (REST preferencias) |
| workers-backend | 3014 | 5014 | HTTP interno (`/health`, `/metrics`, `/api/v1/dlq`) |
| marketing-backend | 3015 | 5015 | HTTP público (REST + `/internal/*` para superadmin) |

Libres dentro del rango: HTTP 3016–3019 y gRPC 5016–5019.

## URLs en local

| Servicio | HTTP | gRPC |
|---|---|---|
| chatia | http://localhost:3010 | localhost:5010 |
| pasarelapagos | http://localhost:3011 | localhost:5011 |
| analytics | http://localhost:3012 | localhost:5012 |
| notificaciones | http://localhost:3013 | localhost:5013 |
| workers | http://localhost:3014 | localhost:5014 |
| marketing | http://localhost:3015 | localhost:5015 |

Healthcheck de cada servicio: `/health`.

## Quién llama a quién (gRPC)

| Servicio | Variable | Valor local |
|---|---|---|
| chatia | `ANALYTICS_GRPC_URL` | `localhost:5012` |
| chatia | `NOTIF_GRPC_URL` | `localhost:5013` |
| chatia | `WORKERS_GRPC_URL` | `localhost:5014` |
| pasarelapagos | `CHATIA_GRPC_URL` | `localhost:5010` |
| notificaciones | `CHATIA_GRPC_URL` | `localhost:5010` |
| workers | `CHATIA_GRPC_URL` | `localhost:5010` |
| workers | `NOTIF_GRPC_URL` | `localhost:5013` |
| workers | `ANALYTICS_GRPC_URL` | `localhost:5012` |

analytics y marketing no llaman a otros servicios por gRPC.
`PAGOS_GRPC_URL` (default `localhost:5011`) existe en `packages/grpc-client`.

En Railway el formato es `<servicio>.railway.internal:<puerto gRPC>`; el puerto debe coincidir con el `GRPC_PORT` del servicio destino.

## Dónde están definidos

- `PORT` y `GRPC_PORT`: `<servicio>/.env`, `.env.example` y default en `src/main.ts`.
- Defaults de clientes gRPC: `packages/grpc-client/src/*`, `notificaciones-backend/src/queue/dlq/dlq.module.ts`, `workers-backend/src/core/jobs/jobs.module.ts`.
- Docker: `ENV PORT`, `EXPOSE` y `HEALTHCHECK` en `<servicio>/Dockerfile`.
- Documentación: `.claude/CLAUDE.md`, `.claude/conventions/entorno.md`, `.claude/infrastructure/environments.md`.

## Infraestructura local compartida

| Recurso | Dirección |
|---|---|
| PostgreSQL (ecosistema-ms) | `localhost:5435` (usuario `postgres`, una base por servicio) |
| Redis (ecosistema-ms) | `localhost:6381` |


# Puertos — ecosistema (rango 3020–3029)

| Servicio | Puerto |
|---|---|
| realsass-sass-back | 3020 |
| realsass-sass-front | 3021 |
| realsass-dashboard-front | 3022 |
| real-ecommerce-front | 3023 |
| realsass-ecommerce-back | 3025 |

## Infra local (docker-compose)

| Servicio | Puerto |
|---|---|
| postgres-back (`realsass_back_db`) | 5432 |
| postgres-ecommerce (`realsass_ecommerce_db`) | 5433 |
| redis | 6379 |

## Infraestructura local (docker-compose)

| Servicio | Puerto host |
|----------|-------------|
| PostgreSQL | 5434 |
| Redis | 6380 |

## Notas

- La asignación por servicio dentro de `ecosistema-ms` y `ecosistema` la definió el superadmin: cada uno de esos repos tiene que configurar su `PORT` con el valor de esta tabla.
- Railway no usa estos puertos: cada servicio toma el `PORT` que inyecta Railway. El `Dockerfile` del backend sigue con `PORT=4000` por defecto.
- Las URLs `*.railway.internal` de producción no cambian.
