# Checklist: Nuevo proveedor de pago

## Diseño
- [ ] Adapter implementa la interface `PaymentProvider` de `provider.interface.ts`
- [ ] Módulo propio en `providers/adapters/{proveedor}/{proveedor}.module.ts`
- [ ] No expone tipos del SDK del proveedor fuera del adapter
- [ ] Circuit breaker configurado en `CircuitBreakerService`

## Implementación
- [ ] `createPayment()` retorna `{ providerId, status, metadata }`
- [ ] `getPayment()` consulta estado en el proveedor
- [ ] `refund()` implementado
- [ ] `verifyWebhookSignature()` implementado
- [ ] Credenciales solo via `ConfigService` (env vars)

## Seguridad
- [ ] Webhook signature verification antes de procesar
- [ ] PII nunca persistido — solo tokens del proveedor
- [ ] Credenciales en env vars, no hardcodeadas

## Tests
- [ ] Test unitario del adapter con SDK mockeado
- [ ] Test de `verifyWebhookSignature` con firma válida e inválida
- [ ] FakeAdapter actualizado si aplica para paridad de comportamiento

## RoutingService
- [ ] Proveedor registrado en `RoutingService.selectProvider()`
- [ ] Condición de routing documentada (país, plan, etc.)

## Variables de entorno
- [ ] Credenciales agregadas a `.env.example`
- [ ] Documentadas en `.claude/services/pasarelapagos-backend.md`
