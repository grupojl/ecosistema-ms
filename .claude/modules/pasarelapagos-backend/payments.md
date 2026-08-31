# Módulo: payments (pasarelapagos-backend)

## Responsabilidad
Crear, consultar y conciliar pagos. Abstracción sobre los proveedores via RoutingService.

## Flujo de pago
```
POST /payments
  → validar DTO + TenantContext
  → PaymentsService.create()
    → RoutingService.selectProvider(tenant.config)
    → [StripeAdapter | MPAdapter | ...].createPayment()
    → persistir Payment en DB
    → enqueue job de reconciliación
  → retornar Payment con estado PENDING
```

## Estados de pago
`PENDING` → `COMPLETED` | `FAILED` | `REFUNDED`

## Invariantes
- Un pago siempre tiene un `providerId` (ID del proveedor externo)
- PII (datos de tarjeta) nunca se persisten — solo tokens del proveedor
- El `idempotencyKey` del cliente se mapea al `jobId` del job de reconciliación

## Reconciliación
Job BullMQ `reconcile` corre tras crear el pago y al recibir webhook del proveedor.
Actualiza el estado local según el estado del proveedor (source of truth).

## Endpoints
| Método | Path | Descripción |
|--------|------|-------------|
| POST | `/payments` | Crear pago |
| GET | `/payments/:id` | Detalle |
| GET | `/payments` | Listar con filtros |
| POST | `/payments/:id/refund` | Reembolso |
