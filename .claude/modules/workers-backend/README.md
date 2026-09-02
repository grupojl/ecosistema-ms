# workers-backend — Panel de módulos

## ¿Qué es?

Servicio de workers BullMQ. Procesa jobs asíncronos: campañas de mensajería masiva,
indexación de vectores para RAG de chatia-backend, monitoreo de DLQ.

## Jobs principales

| Job | Processor | Producido por |
|-----|-----------|---------------|
| Campaña email | `campaign-email-job.dto.ts` | campaigns service |
| Vector index | `vector-index-job.dto.ts` | chatia-backend (indirecto) |

## Estado actual

⚠️ Sin Domain/Repository en campaigns.
Los DTOs de jobs son payloads BullMQ — migrar a Zod (son serializados/deserializados).
