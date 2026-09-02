# Módulo: payments (MOLDE VIVO de pagos — pendiente de migración)

## ¿Qué hace?

Orquesta el ciclo de vida de un pago: creación, procesamiento por el provider,
confirmación/rechazo, reconciliación y estados intermedios.

## Invariantes de dominio (a implementar en domain/)

- Un pago en estado `COMPLETED` no puede transicionar a otro estado
- Un pago solo puede tener un `paymentIntentId` asignado
- La reconciliación no puede alterar el `amount` original
- Los datos PII del comprador pasan por `PiiService` antes de persistirse

## Estado actual

⚠️ `payments.service.ts` llama `PrismaService` directamente.
**CRÍTICO — transacciones financieras deben tener domain tipado.**
Migrar a Domain + Repository — ver ADR-002.
