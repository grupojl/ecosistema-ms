# Checklist: Deploy a Railway

Ver patrones completos en:
- `architecture/05-dockerfile-backend.md`
- `architecture/06-dockerfile-frontend.md`
- `architecture/07-railway-deploy.md`

---

## Pre-deploy

- [ ] `pnpm typecheck` pasa sin errores en el microservicio afectado
- [ ] `pnpm test` pasa con cobertura ≥ 85%
- [ ] No hay `catalog:algo` (named catalogs) en package.json
- [ ] Variables de entorno nuevas documentadas en `.env.example` del servicio
- [ ] Si hay cambios de proto: servidor deploado primero

## Dockerfile — checklist completo (backend)

- [ ] `--platform=linux/amd64` en cada `FROM` — build reproducible desde cualquier host
- [ ] `dumb-init` instalado en stage `deps` y stage `runtime`
- [ ] `ARG PNPM_VERSION` al inicio — una sola fuente de verdad
- [ ] Solo `package.json` copiados en stage `deps` (no el source)
- [ ] `pnpm install --frozen-lockfile` con cache mount id único por servicio
- [ ] `prisma generate` antes de `pnpm build` en stage `build`
- [ ] Runtime copia solo `dist/`, `node_modules`, `prisma/`, `package.json`
- [ ] `entrypoint.sh` copiado con `--chown=nestjs:nodejs`
- [ ] Usuario `nestjs` UID 1001 antes del CMD
- [ ] `HEALTHCHECK` con puerto hardcodeado (no variable de entorno)
- [ ] `CMD ["dumb-init", "/app/<servicio>/entrypoint.sh"]`

## entrypoint.sh — checklist

- [ ] `#!/bin/sh` + `set -e`
- [ ] `prisma migrate deploy` antes de arrancar el servidor
- [ ] `exec node dist/main.js` (con `exec` — señales directas a Node)
- [ ] `chmod +x` aplicado

## Dockerfile — checklist completo (frontend)

- [ ] `output: 'standalone'` en `next.config.mjs` verificado
- [ ] `--platform=linux/amd64` en cada `FROM`
- [ ] Todos los `NEXT_PUBLIC_*` como `ARG` + `ENV` en stage `build`
- [ ] `.next/static` copiado al runtime
- [ ] `public/` copiado al runtime
- [ ] `HOSTNAME=0.0.0.0` en runtime
- [ ] `NEXT_TELEMETRY_DISABLED=1` en build y runtime
- [ ] `CMD ["node", "server.js"]`

## Configuración Railway (verificar una vez, no cada deploy)

- [ ] Root Directory: `/`
- [ ] Dockerfile Path: `{servicio}/Dockerfile`
- [ ] Build Command: vacío
- [ ] Health Check Path: `/health`

## Si hay migration de DB

- [ ] Migration testeada en local con `prisma migrate dev`
- [ ] `entrypoint.sh` tiene `prisma migrate deploy` — corre automático en cada deploy
- [ ] No se necesita `start:migrate` manual — el entrypoint lo maneja

## Post-deploy

- [ ] Health check responde `200` en `GET /health`
- [ ] `GET /metrics` responde con métricas Prometheus
- [ ] Logs no muestran errores de conexión a DB, Redis o gRPC
- [ ] Si hay comunicación gRPC: verificar que las URLs `.railway.internal` resuelven

## CI/CD — GitHub Actions por servicio

- [ ] `pnpm audit --audit-level=high` — falla si hay CVE crítico o alto
- [ ] Build con `--platform linux/amd64` explícito en el workflow
- [ ] **Trivy** escanea la imagen final — exit-code 1 en CRITICAL/HIGH con fix disponible
- [ ] **Cosign** firma la imagen en push a main (keyless OIDC)
- [ ] Path filters: el workflow solo corre cuando cambia `{servicio}/` o `packages/`
- [ ] Permisos: `packages: write` + `id-token: write` en el job

Ver template completo en `architecture/05-dockerfile-backend.md` (sección GitHub Actions).
