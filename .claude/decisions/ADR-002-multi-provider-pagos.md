# ADR-002 — Arquitectura multi-provider en pasarelapagos

**Estado**: Aceptado
**Fecha**: 2024-01

## Contexto
Necesitamos soportar múltiples pasarelas de pago (Stripe, MercadoPago, Conekta, dLocal,
Pagarmé) con routing inteligente por país/organización y circuit breaker ante fallos.

## Decisión
Pattern de Adapter por proveedor + RoutingService que selecciona el adapter según
la configuración del tenant. CircuitBreakerService protege contra fallos en cascada.

```
PaymentsService → RoutingService → [StripeAdapter | MPAdapter | ...]
                                  ↑
                            CircuitBreakerService
```

## Alternativas consideradas
| Opción | Por qué se descartó |
|--------|---------------------|
| Un servicio por proveedor | Demasiado overhead operacional |
| SDK de cada proveedor directo en service | Acoplamiento, difícil de testear |

## Consecuencias
- ✅ Agregar nuevo proveedor = nuevo adapter sin tocar lógica de negocio
- ✅ Circuit breaker aísla fallos de proveedores
- ✅ FakeAdapter permite testing sin credenciales reales
- ⚠️ RoutingService es punto de decisión crítico — requiere tests exhaustivos
