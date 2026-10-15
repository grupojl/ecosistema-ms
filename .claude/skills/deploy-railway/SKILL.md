---
name: deploy-railway
description: Preparar y verificar el despliegue de un servicio del monorepo en Railway (staging o producción) — variables de entorno exigidas, Postgres/Redis, migraciones, imagen Docker y smoke test con webhook firmado. Usar cuando el usuario pida "subir a Railway", "desplegar", "armar staging", "qué variables faltan" o "está listo para producción".
---

# deploy-railway

Referencias: `architecture/05-dockerfile-backend.md`, `architecture/07-railway-deploy.md`, `checklists/deploy-railway.md`.
**Nunca desplegar sin pasar `verify`.** Y no decir "listo para producción": decir qué se verificó y qué no.

## 1. Pre-vuelo local
```bash
node .claude/skills/verify/scripts/verify.js <svc> --integration
node .claude/skills/security-review-tenant/scripts/scan.js <svc>      # sin ALTA
node .claude/skills/deploy-railway/scripts/required-env.js <svc>      # matriz de variables
```
- Revisar el `git diff` de `pnpm-lock.yaml` (no debe traer cambios ajenos) y que no haya `.bak`/`x.sh` ni secretos en el commit.
- Hay cambios de contrato con frontends (p. ej. un endpoint que ahora exige token)? Avisar **antes** de desplegar.

## 2. Infraestructura en Railway
- Servicio **Postgres** (con `pgvector` si el servicio usa RAG: chatia) y servicio **Redis**.
- Servicio de la app con el `Dockerfile` y `railway.json` del repo (`healthcheckPath: /health/ready`).
- **Base de datos nueva y vacía** → `entrypoint.sh` corre `prisma migrate deploy` solo.
  **Base existente** creada con `db push` → fallará con P3005: hacer *baseline* de las migraciones antes (no probado por nosotros).
- Variables: salen de `required-env.js` (lee el esquema de validación del servicio). En producción faltar una **hace fallar el arranque a propósito**.
  Las PROHIBIDAS (`ALLOW_DEV_AUTH`, `SWAGGER_ENABLED=true`) también lo hacen fallar.
- Generar secretos: `openssl rand -base64 32` (cifrado de tokens), y `-hex 24` para claves de API internas.
- **Rotar** cualquier clave que haya aparecido en una salida o en el `.env` local.

## 3. Primer despliegue (staging)
1. Desplegar y mirar el log de build: **es la primera vez que la imagen Docker se construye de verdad** (el build local no prueba Docker; el Dockerfile usa `shamefully-hoist`).
2. `GET /health/live` → 200 · `GET /health/ready` → 200 (verifica Postgres y Redis).
3. **Smoke test con webhook firmado** (crea un mensaje real en la cuenta indicada: usar una cuenta de prueba):
   ```bash
   node .claude/skills/deploy-railway/scripts/smoke-webhook.js \
     --url https://<app>.up.railway.app --external-id <phone_number_id> \
     --secret <META_APP_SECRET> --verify-token <webhookVerifyToken de la cuenta>
   ```
   Espera: firmado → 200, firma inválida → 401, sin firma → 401, verificación GET con token → challenge.
4. En los logs de Railway confirmar la cadena: webhook → job `incoming-message` → `auto-reply` → envío saliente
   (un error de Meta por número de prueba es esperable; lo importante es que el job se encole y procese con **Redis real**).
5. Si la base ya tenía tokens de canal en claro y se activó el cifrado: `pnpm encrypt:tokens` (primero con `DRY_RUN=1`).

## 4. Antes de producción (además de lo anterior)
- Claves de proveedores probadas con tráfico real en español (LLM, STT, TTS, embeddings) y `pgvector` confirmado.
- Pruebas de carga, backups de Postgres con restauración probada, RTO/RPO y runbook (hoy **no existen**).
- Alertas técnicas con destino definido (hoy solo log + métrica).
- Branch protection en `main` y CI en verde (build de imagen + Trivy).

## Qué reportar al usuario
Una tabla corta: **verificado** (con el comando) / **no verificado** / **bloqueante**. Sin adjetivos.
