# Módulo: attribution — marketing-backend

## Responsabilidad
Atribuir conversiones (pagos confirmados) a campañas publicitarias.

## Flujo
```
pasarelapagos-backend
  → pago transiciona a COMPLETED
  → fire-forget: queue.add('attribute-conversion', payload, { jobId: `attribution:${paymentId}` })

marketing-backend / AttributeConversionProcessor
  → recibe job
  → busca AdAccount activo de la org con campaña reciente
  → crea AttributionEvent { paymentId, campaignId, revenue, ... }
  → emite a analytics-backend (analytics-events queue) para persistencia

analytics-backend
  → persiste evento de conversión en sus proyecciones
```

## Idempotencia
`jobId = attribution:${paymentId}` → BullMQ garantiza que el mismo pago
no genera dos AttributionEvent aunque el job se reencole.

## Limitaciones conocidas (v1)
- Atribución por last-click: la campaña activa más reciente de la org
- Sin fingerprinting de usuario ni cookies — cookieless por diseño
- Multi-touch attribution: Fase 2 (requiere pixel tracking adicional)

## Estado actual
⏳ Pendiente implementación
