# Checklist: Deploy a Railway

## Pre-deploy
- [ ] `pnpm typecheck` pasa sin errores en el microservicio afectado
- [ ] `pnpm test` pasa con cobertura ≥ 85%
- [ ] No hay `catalog:algo` (named catalogs) en package.json
- [ ] Variables de entorno nuevas documentadas en `.env.example` del servicio
- [ ] Si hay cambios de proto: servidor deploado primero

## Configuración Railway (verificar una vez, no cada deploy)
- [ ] Root Directory: `/`
- [ ] Dockerfile Path: `{servicio}/Dockerfile`
- [ ] Build Command: vacío
- [ ] Health Check Path: `/health`

## Si hay migration de DB
- [ ] Migration testeada en local con `prisma migrate dev`
- [ ] Start command temporalmente en `start:migrate` para el primer deploy
- [ ] Verificar que `prisma migrate deploy` corre antes de levantar el servidor

## Post-deploy
- [ ] Health check responde `200` en `GET /health`
- [ ] `GET /metrics` responde con métricas Prometheus
- [ ] Logs no muestran errores de conexión a DB, Redis o gRPC
- [ ] Si hay comunicación gRPC: verificar que las URLs `.railway.internal` resuelven
