# ecosistema-ms — instrucción raíz para el AI

## Stack canónico

- Backend: NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- Comunicación inter-servicio: gRPC (`@nestjs/microservices` + `@grpc/grpc-js`)
- Contratos: `packages/proto/proto/*.proto` → `@ecosistema-ms/proto`
- Auth: Firebase Authentication (client) + Firebase Admin (server)
- Workspace: pnpm 10 workspaces con **catalog único** (ver `conventions/entorno.md`)
- Deploy: Railway — servicios separados, mismo repo

## Microservicios

| Carpeta | Puerto HTTP | Puerto gRPC | Rol |
|---------|-------------|-------------|-----|
| `chatia-backend` | 3000 | 5001 | Chat IA, Knowledge Base, Canales, Agentes |
| `pasarelapagos-backend` | 3001 | 5002 | Pagos MercadoPago/Stripe/dLocal/Conekta |
| `notificaciones-backend` | 3002 | 5003 | Email, Push, WhatsApp, DLQ |
| `analytics-backend` | 3003 | 5004 | Eventos, Proyecciones, SSE |
| `workers-backend` | 3004 | 5005 | Campañas, Jobs BullMQ, Vector Index |

## Packages compartidos

| Carpeta | Nombre pkg | Rol |
|---------|-----------|-----|
| `packages/proto` | `@ecosistema-ms/proto` | Contratos gRPC (.proto files + paths TS) |
| `packages/auth-server` | `@ecosistema-ms/auth-server` | Guards, decorators, TenantContext NestJS |
| `packages/grpc-client` | `@ecosistema-ms/grpc-client` | Módulos NestJS para llamadas gRPC inter-servicio |

## Antes de escribir cualquier código

1. Leer `architecture/00-principios.md` — reglas de aislamiento Railway
2. Leer `architecture/03-reglas-duras.md` — qué bloquea un PR
3. Leer `services/<servicio>.md` — carpetas BLOQUEANTES vs DINÁMICAS
4. Leer `modules/<servicio>/<modulo>.md` — contexto del módulo a tocar

## Reglas CRÍTICAS (resumen ejecutivo)

- **Catalog único**: `catalog:algo` en package.json → bug, normalizar a `catalog:`
- **Sin DTOs class-validator**: todo input nuevo = schema Zod inline en el controller
- **Sin cross-service import**: los microservicios se comunican por gRPC/HTTP, nunca por import directo
- **Todo query lleva `ecosystemId` + `organizationId`**: sin scope = filtración de datos
- **Sin `as any` ni `as unknown as`** en repositories: usar `toEntity()` privado
- **Carpetas BLOQUEANTES** no se modifican sin ADR: ver `services/<servicio>.md`

## Relación con otros ecosistemas

- `grupojl/welver` (ecosistema 1) consume estos microservicios via HTTP + gRPC
- Aislamiento por `FIREBASE_PROJECT_ID` + `DATABASE_URL` separada por ecosistema cliente
- El `TenantGuard` resuelve `ecosystemId` del token Firebase en cada request
