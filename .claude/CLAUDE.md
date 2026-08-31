# Ecosistema MS — grupojl/ecosistema-ms

## Identidad del repositorio
Monorepo de microservicios que alimentan al ecosistema principal (`grupojl/welver`).
Cada microservicio corre como servicio independiente en Railway, apuntando al mismo repo.

## Entorno de desarrollo
- Windows + Git Bash
- Node 24.14.0 / pnpm 10.30.3
- Deploy: Railway (Root Dir `/`, Dockerfile Path `{servicio}/Dockerfile`)

## CRÍTICO — pnpm catalog
`catalog:algo` (named catalogs) **NO funcionan**. Usar siempre `catalog:` (default único).
Si ves `catalog:backend`, `catalog:grpc`, etc. → es un bug, normalizar a `catalog:`.

## Microservicios
| Carpeta | Puerto HTTP | Puerto gRPC | Rol |
|---------|-------------|-------------|-----|
| `chatia-backend` | 3000 | 5001 | Chat IA, Knowledge Base, Canales, Agentes |
| `pasarelapagos-backend` | 3001 | 5002 | Pagos multi-provider, Transacciones |
| `notificaciones-backend` | 3002 | 5003 | Email, Push, WhatsApp, DLQ |
| `analytics-backend` | 3003 | 5004 | Eventos, Proyecciones, SSE, Export |
| `workers-backend` | 3004 | 5005 | Jobs BullMQ, Campaigns, Embeddings, DLQ |

## Packages compartidos
| Carpeta | Nombre | Rol |
|---------|--------|-----|
| `packages/proto` | `@ecosistema-ms/proto` | Contratos gRPC (.proto + paths TS) |
| `packages/auth-server` | `@ecosistema-ms/auth-server` | Guards, decorators, TenantContext |
| `packages/grpc-client` | `@ecosistema-ms/grpc-client` | Módulos NestJS gRPC inter-servicio |

## Comunicación inter-servicio
- **gRPC** sobre red privada Railway para llamadas síncronas
- Local: `localhost:500X` | Railway: `{servicio}.railway.internal:500X`
- Variables: `CHATIA_GRPC_URL`, `PAGOS_GRPC_URL`, `NOTIF_GRPC_URL`, `ANALYTICS_GRPC_URL`, `WORKERS_GRPC_URL`
- **BullMQ** sobre Redis compartido para jobs asíncronos
- **HTTP REST** para consumidores externos (welver, clientes)

## Multi-tenancy
Toda query lleva `ecosystemId` + `organizationId` como filtros obligatorios.
El `TenantGuard` de `@ecosistema-ms/auth-server` los resuelve del token Firebase.

## Stack
- NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- gRPC: `@nestjs/microservices` + `@grpc/grpc-js`
- Auth: Firebase Authentication + Firebase Admin SDK

## Relación con welver/
`grupojl/welver` consume estos microservicios via HTTP + gRPC.
Cada ecosistema cliente tiene su propio `FIREBASE_PROJECT_ID` y `DATABASE_URL`.

## Antes de tocar cualquier código
1. Leer `.claude/architecture/00-principios.md`
2. Leer `.claude/services/{servicio}.md` del microservicio afectado
3. Verificar `.claude/contracts/grpc-contracts.md` si hay cambios en protos
4. Aplicar el checklist de `.claude/checklists/` correspondiente
