# Servicio: pasarelapagos-backend

## Rol
Pasarela de pagos multi-provider — MercadoPago, Stripe, Conekta, dLocal,
Pagarme y Fake. Routing dinamico con circuit breaker.

## Puertos
- HTTP: 3001
- gRPC: 5002

## Score actual: 8.0/10 — el MS mas maduro del ecosistema

| Area | Estado |
|------|--------|
| PaymentProvider interface | OK — contrato limpio e inmutable |
| RoutingService con CB y cache 5min | OK |
| CircuitBreakerService (opossum) | OK — healthOf(), statsOf() |
| State machine de pagos | OK — assertValidTransition() |
| Idempotencia (idempotencyKey) | OK — @@unique([tenantId, idempotencyKey]) |
| PII cifrado at-rest | OK — pii.service.ts, email en Customer |
| API Keys (bcrypt + prefix pk_) | OK — rawKey solo se muestra en create |
| Reconciliacion cron + BullMQ | OK — cada 5min, pagos PENDING > 30min |
| WebhookInbound idempotente | OK — @@unique([providerId, externalId]) |
| DLQ processor | OK — TODO en codigo: conectar a Slack/Sentry |
| OpenTelemetry dep instalada | OK — unico MS con la dep |
| Tests | 0 tests — DT-001 |
| PCI DSS formal | Sin certificacion |

## Providers

stripe, mercadopago, conekta, dlocal, pagarme, fake (testing)

## Variables de entorno

DATABASE_URL=
REDIS_URL=
REDIS_ENABLED=true
FIREBASE_PROJECT_ID=
STRIPE_SECRET_KEY=
MERCADOPAGO_ACCESS_TOKEN=
CONEKTA_PRIVATE_KEY=
ENCRYPTION_KEY=
PORT=3001
GRPC_PORT=5002
RECONCILE_CRON=   # opcional
