# analytics-backend — Panel de módulos

## ¿Qué es?

Servicio de analíticas del ecosistema. Recibe eventos via gRPC,
los persiste, genera proyecciones agregadas y las expone via SSE
para dashboards en tiempo real y via HTTP para exportación.

## Flujo principal

1. Productor (chatia-backend, pagos-backend) → gRPC `PersistEvent`
2. `analytics-event.processor.ts` → procesa y genera proyecciones
3. `projections.service.ts` → actualiza las métricas agregadas
4. `sse.service.ts` → emite actualizaciones a clientes conectados
5. HTTP `GET /analytics/*` → consulta y exportación

## Estado actual

⚠️ Sin Domain/Repository. Las proyecciones son candidatas a value objects.
