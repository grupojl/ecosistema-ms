# Markets en pasarelapagos-backend

## Rol

Pagos ya usa Stripe que maneja multi-moneda y multi-país de forma nativa.
El rol de Market aquí es de **auditoría y trazabilidad**, no de lógica de pago.

## Lo que se registra

En cada transacción se guarda el país del comprador para:
- Reconciliación contable por mercado
- Reportes de revenue por país en el superadmin
- Cumplimiento fiscal (saber en qué país ocurrió la transacción)

## Cambios en el modelo de Transaction

```prisma
model Transaction {
  // ... campos existentes ...
  marketCountry  String?  @map("market_country")  // NUEVO — ISO 3166-1 alpha-2
  // Stripe ya registra country en el PaymentIntent — esto lo espeja en nuestra DB
}
```

## Checklist

- [ ] MKT-PP-01: Migración Prisma — `marketCountry` en Transaction
- [ ] MKT-PP-02: Extraer de header `X-Market-Country` en PaymentController
- [ ] MKT-PP-03: Pasar a TransactionService al registrar pago
- [ ] MKT-PP-04: Incluir en listado interno de transacciones (para superadmin)
