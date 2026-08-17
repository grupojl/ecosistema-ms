# Ecosistema MS — grupojl/ecosistema-ms

## Entorno
- Windows + Git Bash
- Node 24.14.0
- pnpm 10.30.3
- Deploy: Railway (servicios separados, mismo repo)

## CRÍTICO — pnpm catalog
**Los named catalogs NO funcionan en este entorno.**
Usar SIEMPRE un solo `catalog:` default para todo el ecosistema.
Si ves `catalog:algo` en cualquier package.json → es un bug, hay que normalizarlo a `catalog:`.

## Microservicios

| Carpeta | Nombre pkg | Puerto HTTP | Puerto gRPC | Rol |
|---------|-----------|-------------|-------------|-----|
| `chatia-backend` | `chatia-backend` | 3000 | 5001 | Chat IA, Knowledge Base, Canales, Agentes |
| `pasarelapagos-backend` | `pasarelapagos-backend` | 3001 | 5002 | Pagos MercadoPago/Stripe, Transacciones |

## Packages compartidos

| Carpeta | Nombre pkg | Rol |
|---------|-----------|-----|
| `packages/proto` | `@ecosistema-ms/proto` | Contratos gRPC (.proto files + paths TS) |
| `packages/auth-server` | `@ecosistema-ms/auth-server` | Guards, decorators, TenantContext NestJS |
| `packages/grpc-client` | `@ecosistema-ms/grpc-client` | Módulos NestJS para llamadas gRPC inter-servicio |

## Comunicación inter-servicio

- **gRPC** sobre red privada Railway para llamadas síncronas entre microservicios
- Contratos definidos en `packages/proto/proto/*.proto`
- En local: `localhost:500X` | En Railway: `{servicio}.railway.internal:500X`
- Variables de entorno: `CHATIA_GRPC_URL`, `PAGOS_GRPC_URL`

## Stack
- Backend: NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- Comunicación: gRPC (`@nestjs/microservices` + `@grpc/grpc-js`)
- Auth: Firebase Authentication (client) + Firebase Admin (server)
- Workspace: pnpm 10 workspaces con catalog único

## Convenciones de código
- TypeScript strict — `any` implícito es bug de diseño
- Lógica de negocio en domain/application, nunca en controllers
- Queries N+1 son errores — siempre `include` explícito en Prisma
- RBAC: OWNER > ADMIN > MEMBER > VIEWER
- Multi-tenant: toda query lleva `ecosystemId` + `organizationId` como filtro obligatorio
- Cobertura mínima 85% en paths críticos
- Cada microservicio expone: HTTP (público) + gRPC (interno, solo red privada Railway)

## Relación con otros ecosistemas
- `grupojl/welver` (ecosistema 1) consume estos microservicios via HTTP+gRPC
- Aislamiento por `FIREBASE_PROJECT_ID` + `DATABASE_URL` separada por ecosistema cliente
- El `TenantGuard` resuelve `ecosystemId` del token Firebase en cada request

## Deploy en Railway
Cada microservicio es un servicio separado en Railway apuntando al mismo repo:
- **Root Directory**: `/` (siempre la raíz del monorepo)
- **Dockerfile Path**: `{servicio}/Dockerfile`
- **Build Command**: (vacío, lo maneja el Dockerfile)
- **Variables de entorno**: ver `{servicio}/.env.example`