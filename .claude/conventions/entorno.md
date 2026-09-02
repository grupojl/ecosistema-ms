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
