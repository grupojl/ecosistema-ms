# RUNBOOK — workers-backend

> Documento operacional para on-call y deploys.
> Actualizar cada vez que se agrega un queue o cambia un threshold.

---

## Arquitectura rápida

```
chatia-backend    ──┐
analytics-backend ──┼──► BullMQ (Redis) ──► workers-backend ──► chatia-backend (gRPC)
pasarelapagos     ──┘                                        ──► notificaciones-backend (gRPC)
                                                             ──► Railway Volume (exports)
```

**Queues activas:**
| Queue | Producer | Consumer | Concurrencia env | Default |
|---|---|---|---|---|
| `workers.faq-ingest` | chatia-backend | FaqIngestProcessor | `WORKERS_FAQ_INGEST_CONCURRENCY` | 3 |
| `workers.vector-index` | chatia-backend | VectorIndexProcessor | `WORKERS_VECTOR_INDEX_CONCURRENCY` | 5 |
| `workers.campaign-email` | workers-backend (campaigns) | CampaignEmailProcessor | `WORKERS_CAMPAIGN_EMAIL_CONCURRENCY` | 10 |
| `workers.analytics-export` | analytics-backend | AnalyticsExportProcessor | — | 1 |

---

## Monitoreo de queues

### Ver tamaño de queues en tiempo real
```bash
# Via API
curl https://workers-backend.railway.app/api/v1/dlq/stats \
  -H "Authorization: Bearer $TOKEN"

# En Railway: ver logs del servicio
railway logs -s workers-backend -f
```

### Alertas automáticas
- DLQ > 500 jobs → log WARN
- DLQ > 1000 jobs → log ERROR

---

## Retry masivo de DLQ

### Retry de un job específico
```bash
curl -X POST https://workers-backend.railway.app/api/v1/dlq/workers.faq-ingest/{jobId}/retry \
  -H "Authorization: Bearer $TOKEN"
```

### Retry de todos los jobs de una queue
```bash
# Listar todos los jobs fallidos
curl https://workers-backend.railway.app/api/v1/dlq \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.queue == "workers.faq-ingest") | .jobId'

# Para cada jobId, hacer retry
for id in $(lista_de_ids); do
  curl -X POST https://workers-backend.railway.app/api/v1/dlq/workers.faq-ingest/$id/retry \
    -H "Authorization: Bearer $TOKEN"
done
```

---

## Ajustar concurrencia sin downtime

1. En Railway → workers-backend → Variables
2. Modificar `WORKERS_FAQ_INGEST_CONCURRENCY` (u otro)
3. Railway redespliega automáticamente
4. Los jobs en vuelo terminan antes del shutdown

**Guía de tuning:**
- CPU-bound (faq-ingest, vector-index): concurrencia = nro de vCPUs del pod
- IO-bound (campaign-email): concurrencia = 10-20 (espera de red predomina)

---

## Pausar una queue en emergencia

```bash
# Via BullMQ API directa (si tenés acceso al Redis)
redis-cli LPUSH bull:workers.faq-ingest:paused 1

# Via Railway: escalar workers-backend a 0 instancias
railway scale -s workers-backend --replicas 0

# Retomar
railway scale -s workers-backend --replicas 1
```

---

## Circuit Breaker — Groq/OpenAI

### Ver estado actual
```bash
curl https://workers-backend.railway.app/api/v1/health \
  -H "Authorization: Bearer $TOKEN" | jq '.circuitBreakers'
```

### Estados:
- `CLOSED` → normal, todo bien
- `HALF_OPEN` → probando si el servicio se recuperó
- `OPEN` → servicio no disponible, jobs en espera

### Cuando está OPEN:
1. Los jobs de embedding fallan con "Circuit breaker OPEN"
2. BullMQ reintentará con backoff exponencial
3. Después de 30s pasa a HALF_OPEN automáticamente
4. Si el primer intento en HALF_OPEN falla → vuelve a OPEN

### Reset manual del circuit breaker (en emergencia):
```bash
# Conectar al Redis del ecosistema
redis-cli DEL cb:groq-embeddings:state cb:groq-embeddings:failures cb:groq-embeddings:open_since
```

---

## Checklist de deploy

### Deploy sin cambio de schema
- [ ] `pnpm typecheck` sin errores
- [ ] CI verde en rama
- [ ] Variables de entorno nuevas agregadas en Railway antes del deploy
- [ ] Verificar `/api/v1/health` post-deploy

### Deploy con migración de schema
- [ ] Correr `pnpm --filter workers-backend prisma migrate deploy` antes del nuevo código
- [ ] Verificar que la migración es backward-compatible (no eliminar columnas usadas)
- [ ] Tener rollback: saber qué migración revertir y cómo
- [ ] Deploy en horario de bajo tráfico

### Deploy de nuevo queue
- [ ] Agregar queue a `WORKER_QUEUES` en `jobs.constants.ts`
- [ ] Registrar en `jobs.module.ts` con `BullModule.registerQueue`
- [ ] Agregar DLQ correspondiente
- [ ] Documentar en este RUNBOOK
- [ ] Agregar env var de concurrencia si aplica

---

## Logs útiles

```bash
# Ver jobs procesados (filtrar por queue)
railway logs -s workers-backend | grep "workers.faq-ingest"

# Ver errores de circuit breaker
railway logs -s workers-backend | grep "Circuit breaker"

# Ver DLQ alerts
railway logs -s workers-backend | grep "DLQ"

# Ver SLA violations
railway logs -s workers-backend | grep "SLA superado"
```

---

## Contactos

| Rol | Cuándo contactar |
|---|---|
| On-call backend | DLQ > 1000 o circuit breaker OPEN > 5min |
| Groq/OpenAI support | Circuit breaker OPEN por falla de su API |
| Railway support | Problemas de infraestructura, Redis HA |
