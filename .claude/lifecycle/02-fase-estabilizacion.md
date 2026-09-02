# Fase 2 — Estabilización
## Escalones 3, 5, 6 — Antes de producción real

**Estado:** ⚪ Pendiente — iniciar cuando Fase 1 esté completa
**Cuándo:** Antes de que el primer ecosistema reciba tráfico real
**Referentes:** Cloudflare (infra) · Vercel/GitHub (CI/CD) · Datadog (observabilidad)

---

## Escalón 3 — Infraestructura y Red

### Qué significa para ecosistema-ms

Proxy inverso con HTTPS, aislamiento de contenedores por servicio,
firewall restringido a puertos esenciales, red privada para comunicación interna.

### Qué hay que hacer

1. **Confirmar HTTPS en todos los endpoints públicos** — Railway provisiona
   TLS automáticamente. Verificar que ningún servicio expone HTTP plano al exterior.

2. **Red privada Railway para gRPC** — los endpoints gRPC nunca deben ser
   públicos. Confirmar que `{servicio}.railway.internal:500X` solo es accesible
   desde la red privada de Railway.

3. **CORS estricto** — `ALLOWED_ORIGINS` explícito en cada servicio.
   Sin wildcard `*`. Cada servicio declara exactamente qué orígenes acepta.

4. **Rate limiting en endpoints públicos** — chatia-backend y pasarelapagos-backend
   exponen endpoints públicos. Agregar rate limiting por IP + por `ecosystemId`.

5. **Headers de seguridad** — `Helmet` en cada servicio NestJS:
   `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`.

6. **Firewall Railway** — confirmar que los puertos gRPC (5001-5005) no son
   accesibles desde internet, solo desde la red interna de Railway.

### Cómo saber que este escalón está completo

- `curl http://{servicio}.up.railway.app` → redirige a HTTPS o rechaza
- Los puertos gRPC no responden desde internet
- `ALLOWED_ORIGINS` configurado en los 5 servicios sin wildcard
- Helmet activo en todos los servicios
- Rate limiting activo en endpoints públicos

---

## Escalón 5 — CI/CD y Despliegues

### Qué significa para ecosistema-ms

Pipeline de tests automáticos en cada PR, imágenes Docker inmutables,
deploy automático en merge a main, rollback en menos de 2 minutos.

### Qué hay que hacer

1. **GitHub Actions por servicio** — pipeline que corre en cada PR que
   toca archivos de ese servicio:
   ```yaml
   on:
     push:
       paths:
         - 'chatia-backend/**'
         - 'packages/**'
   jobs:
     test:
       steps:
         - pnpm install
         - pnpm typecheck
         - pnpm test
         - pnpm build
   ```

2. **Typecheck como gate de PR** — si `tsc --noEmit` falla, el PR no puede
   mergearse. Esto es el enforcement del contrato de tipos entre servicios.

3. **Tests como gate de PR** — cuando existan tests (Fase 1 → Fase 6),
   cobertura mínima 85% en paths críticos como condición de merge.

4. **Deploy automático en Railway** — Railway ya hace deploy en push a main.
   Confirmar que el orden es: build → migrate → start, no build → start → migrate.

5. **Rollback documentado** — procedimiento claro para volver a la versión
   anterior si un deploy rompe producción. Railway mantiene el build anterior.

6. **Builds separados por servicio** — un cambio en `chatia-backend` no debe
   triggear rebuild de `pasarelapagos-backend`. Confirmar path filters en Railway.

### Cómo saber que este escalón está completo

- GitHub Actions corre en cada PR con `typecheck` + `build`
- Un PR que rompe `tsc` no puede mergearse
- Deploy en Railway es automático en merge a main
- Rollback documentado y probado al menos una vez

---

## Escalón 6 — Observabilidad y Operaciones

### Qué significa para ecosistema-ms

Logging estructurado en JSON, métricas de Prometheus, health checks reales,
trazabilidad de requests entre servicios, alertas cuando algo falla.

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| Health checks | ✅ Implementado | `GET /health` en los 5 servicios via `@nestjs/terminus` |
| Métricas Prometheus | ✅ Parcial | `prom-client` en notificaciones, analytics, workers |
| Logging estructurado | ⚠️ Verificar | Confirmar que los logs son JSON, no texto plano |
| Trazabilidad gRPC | ❌ No implementado | Sin correlation ID entre servicios |
| Alertas | ❌ No implementado | Sin alertas configuradas |

### Qué hay que hacer

1. **Logging JSON estructurado** — cada log debe tener:
   ```json
   {
     "level": "error",
     "service": "chatia-backend",
     "ecosystemId": "welver",
     "organizationId": "org_123",
     "correlationId": "req_abc",
     "message": "Conversation not found",
     "timestamp": "2026-09-01T00:00:00Z"
   }
   ```

2. **Correlation ID entre servicios** — generar un `correlationId` en el
   primer request HTTP/gRPC y propagarlo en todos los calls subsiguientes.
   Sin esto, trazar un error a través de chatia → analytics → workers es imposible.

3. **Métricas Prometheus en todos los servicios** — estandarizar las métricas
   que expone cada servicio:
   - `http_requests_total` por endpoint, método y status code
   - `grpc_requests_total` por método y status
   - `bullmq_jobs_completed_total` / `bullmq_jobs_failed_total`
   - `prisma_query_duration_seconds`

4. **Health check real** — el `/health` actual verifica memoria y Prisma.
   Agregar verificación de Redis y de la conexión gRPC a servicios dependientes.

5. **Alertas básicas** — cuando el health check falla más de 2 veces
   consecutivas → notificación (email, Slack, webhook). Railway puede
   configurar esto con su sistema de alertas.

6. **Dashboard mínimo** — Grafana o Railway metrics: ver en un vistazo
   si los 5 servicios están saludables y cuál es el throughput actual.

### Cómo saber que este escalón está completo

- Todos los logs son JSON con `ecosystemId`, `organizationId`, `correlationId`
- Prometheus `/metrics` activo en los 5 servicios con las métricas estándar
- Un request a chatia que falla puede trazarse hasta analytics en los logs
- Alerta configurada cuando `/health` falla
- Dashboard básico con estado de los 5 servicios
