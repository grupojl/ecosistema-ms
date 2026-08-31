# pasarelapagos-backend — Pasarela de pagos multi-provider

## Que hace en palabras simples

Procesa pagos sin que el resto del sistema sepa con que proveedor esta trabajando.
Si Stripe tiene problemas, puede cambiar a MercadoPago automaticamente.
Si un proveedor falla demasiado, lo desconecta temporalmente para no seguir
intentando (circuit breaker).

## A quien le sirve

A welver para procesar pagos de clientes. Y a cualquier microservicio que
necesite crear o consultar el estado de un pago.

## Como funciona

1. Llega un `POST /payments` con monto, pais y metodo de pago
2. `RoutingService` elige el mejor proveedor para esa combinacion
   (hay una tabla en DB con la configuracion de rutas por pais/moneda)
3. El provider elegido crea el pago en su sistema
4. Se guarda en DB con un `idempotencyKey` unico — si llega el mismo pago dos
   veces, devuelve el primero sin cobrar dos veces
5. Un job de reconciliacion verifica el estado final con el proveedor

## Providers disponibles

MercadoPago (LATAM), Stripe (internacional), Conekta (Mexico), dLocal (LATAM alternativo),
Pagarme (Brasil), Fake (testing sin credenciales reales)

## Seguridad

- Datos de tarjeta NUNCA se guardan — solo tokens del proveedor
- Emails de clientes cifrados en base de datos (PII)
- Webhooks de proveedores verificados con firma HMAC antes de procesar
- Audit log inmutable de cada operacion financiera

## Estado actual

OK — el MS mas maduro del ecosistema.
Sin tests unitarios todavia (DT-001).
Sin certificacion PCI DSS formal.
