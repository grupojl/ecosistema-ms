# Servicio: chatia-backend

## Rol
Chat IA multicanal — conversaciones, agentes IA, canales (WhatsApp, widget),
Knowledge Base con RAG, asignacion automatica, proyectos por organizacion.

## Puertos
- HTTP: 3000
- gRPC: 5001

## Score actual: 7.2/10

| Area | Estado |
|------|--------|
| Arquitectura de modulos | OK — 15+ modulos bien separados |
| Multi-tenant (ecosystemId + orgId) | OK — TenantGuard implementado |
| BullMQ (queues incoming/outgoing) | OK |
| RAG + Knowledge Base | OK — implementado con Groq |
| Asignacion round-robin / least-load | OK |
| Circuit Breaker en canales salientes | PENDIENTE — DT-004 |
| Circuit Breaker en Groq/LLM | PENDIENTE — DT-004 |
| Tests | 0 tests — DT-001 |
| Observabilidad | Sin pino, sin metricas reales |
| accessToken cifrado | En texto plano — DT-007 |

## Deuda especifica

- AnalyticsModule deprecated pendiente de eliminar (DT-011)
- UpdateAiConfigDto duplicado en service y dto (DT-009)
- accessToken de ChannelAccount sin cifrar at-rest (DT-007)
- Sin CB en GroqService — si Groq cae, todas las conversaciones fallan (DT-004)

## Dominios

| Modulo | Estado |
|--------|--------|
| conversations — lifecycle OPEN/CLOSED/TRANSFERRED | OK |
| messages — ingesta y envio por canal | OK |
| assistant — Groq + RAG fallback | OK |
| faq — KB + RAG (ingestión, query, docs) | OK |
| channels — abstraccion multicanal | OK |
| assignment — round-robin + least-load | OK |
| analytics-events — producer BullMQ best-effort | OK |
| analytics — DEPRECATED, responde 410 | ELIMINAR (DT-011) |
| queue — processors incoming/outgoing | OK |
| ecosystem — context enrichment por cliente | OK |

## Variables de entorno

DATABASE_URL=
REDIS_URL=
FIREBASE_PROJECT_ID=
GROQ_API_KEY=
PORT=3000
GRPC_PORT=5001
ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5004
WORKERS_GRPC_URL=workers-backend.railway.internal:5005
NOTIF_GRPC_URL=notificaciones-backend.railway.internal:5003
