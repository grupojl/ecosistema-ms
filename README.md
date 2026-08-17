# ecosistema-ms

Monorepo de microservicios — grupojl/ecosistema-ms

## Microservicios

| Carpeta | Puerto HTTP | Puerto gRPC | Estado |
|---------|------------|-------------|--------|
| `chatia-backend` | 3000 | 5001 | ✅ existente |
| `pasarelapagos-backend` | 3001 | 5002 | 🚧 scaffold |

## Packages compartidos

| Package | Rol |
|---------|-----|
| `@ecosistema-ms/proto` | Contratos gRPC (.proto files + paths TS) |
| `@ecosistema-ms/auth-server` | Guards, decorators, TenantContext |
| `@ecosistema-ms/grpc-client` | Módulos NestJS para llamadas gRPC inter-servicio |

## Setup local

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar infra local
docker compose up -d

# 3. Copiar .env y configurar
cp chatia-backend/.env.example chatia-backend/.env
cp pasarelapagos-backend/.env.example pasarelapagos-backend/.env

# 4. Correr migraciones
pnpm --filter pasarelapagos-backend start:migrate

# 5. Dev
pnpm dev
```

## Deploy en Railway

Cada microservicio es un servicio separado en Railway apuntando al mismo repo:

**chatia-backend:**
- Root Directory: `/`
- Dockerfile Path: `chatia-backend/Dockerfile`
- Variables: ver `chatia-backend/.env.example`

**pasarelapagos-backend:**
- Root Directory: `/`
- Dockerfile Path: `pasarelapagos-backend/Dockerfile`
- Variables: ver `pasarelapagos-backend/.env.example`

## Comunicación inter-servicio

Los microservicios se comunican via gRPC sobre la red privada de Railway:
- `CHATIA_GRPC_URL=chatia-backend.railway.internal:5001`
- `PAGOS_GRPC_URL=pasarelapagos-backend.railway.internal:5002`
