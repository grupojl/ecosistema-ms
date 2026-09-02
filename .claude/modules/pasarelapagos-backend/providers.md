# Módulo: providers (Adapters de proveedores de pago)

## ¿Qué hace?

Implementa el patrón Adapter para cada proveedor de pago.
El `RoutingService` decide qué proveedor usar según la configuración del tenant.

## Interface BLOQUEANTE

`provider.interface.ts` — contrato que todos los adapters implementan.
**No modificar sin ADR.**

## Proveedores implementados

| Carpeta | Proveedor | Estado |
|---------|-----------|--------|
| `adapters/mercadopago/` | MercadoPago | implementado |
| `adapters/stripe/` | Stripe | implementado |
| `adapters/dlocal/` | dLocal | implementado |
| `adapters/conekta/` | Conekta | implementado |
| `adapters/pagarme/` | PagarMe | implementado |
| `adapters/fake/` | Fake (testing) | implementado |

## Cómo agregar un nuevo proveedor

1. Crear `adapters/<proveedor>/<proveedor>.module.ts`
2. Implementar `IPaymentProvider`
3. Registrar en `providers.module.ts`
4. Agregar lógica de routing en `routing.service.ts`
**No modificar la interface sin ADR.**
