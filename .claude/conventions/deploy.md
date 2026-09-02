# Deploy — Railway

## Principio

Cada microservicio se despliega individual y aisladamente.
Ver `architecture/00-principios.md` para el detalle completo.

## Configuración Railway por servicio

- **Root Directory**: `/` (siempre la raíz del monorepo)
- **Dockerfile Path**: `{servicio}/Dockerfile`
- **Build Command**: vacío (lo maneja el Dockerfile)
- **Variables de entorno**: en Railway dashboard por servicio

## railway.json por servicio

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "{servicio}/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

## Patrón de Dockerfile (multi-stage)

1. **deps** — copia `package.json` mínimos + `pnpm-lock.yaml` + `.npmrc`, corre `pnpm install --frozen-lockfile`
2. **builder** — copia código fuente + `packages/`, recibe `ARG`/`ENV`, corre `pnpm build`
3. **runner** — imagen final mínima, usuario no-root `nestjs`, `EXPOSE` al puerto correspondiente

## Variables de entorno comunes (backs NestJS)

- `DATABASE_URL` — dummy en build, real en runtime vía Railway
- `REDIS_URL` / `REDIS_ENABLED`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `ALLOWED_ORIGINS` — CORS explícito, sin wildcard `*`
- `{SERVICIO}_GRPC_URL` — URLs gRPC de los otros servicios
  - Local: `localhost:500X`
  - Railway: `{servicio}.railway.internal:500X`
