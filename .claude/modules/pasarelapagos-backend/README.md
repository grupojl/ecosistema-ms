# pasarelapagos-backend — Panel de módulos

## ¿Qué es?

El servicio de pagos del ecosistema. Abstrae múltiples proveedores de pago
(MercadoPago, Stripe, dLocal, Conekta, Pagarme) detrás de una interface única,
gestiona la reconciliación y los webhooks de cada proveedor.

## ¿A quién sirve?

- A los ecosistemas clientes via gRPC (`pagos.proto`)
- A los tenants (organizaciones) via HTTP REST (API keys)

## Módulos

| Módulo | Archivo | Estado |
|--------|---------|--------|
| Pagos | [payments.md](payments.md) | ⚠️ Sin Domain/Repo — CRÍTICO |
| Providers | [providers.md](providers.md) | 🟡 Interface definida |
| Webhooks | [webhooks.md](webhooks.md) | ⚠️ Sin Domain/Repo |
