# Deuda técnica — ecosistema-ms

Última actualización: 2026-09-19

---

## Cerrado en sesión 2026-09-19 ✅

- [x] /health extendido (ExtendedHealth) en los 5 MS
- [x] InternalModule en chatia, pasarela y workers
- [x] InternalApiKeyGuard

---

## Pendiente activo

### [ECO-MS-01] INTERNAL_API_KEY en Railway — P0 para producción
Configurar la misma clave en todos los servicios.
Sin esto, superadmin recibe 403 en todos los /internal/*.

### [ECO-MS-02] conversations.service.updated.ts en chatia — P1
Archivo duplicado sin usar. Eliminar:
`chatia-backend/src/conversations/conversations.service.updated.ts`

### [ECO-MS-03] make typecheck en cada MS — P1
Correr antes del próximo deploy:
```bash
pnpm --filter chatia-backend typecheck
pnpm --filter pasarelapagos-backend typecheck
pnpm --filter workers-backend typecheck
pnpm --filter notificaciones-backend typecheck
pnpm --filter analytics-backend typecheck
```

---

## Deuda técnica preexistente (no tocada en esta sesión)

- main.ts con ValidationPipe global coexiste con ZodExceptionFilter (DT-027)
  — documentado, no rompe, se resuelve en S4
- DT-ECO-01 (domain/repo en ecommerce-back) — cerrado en sesión 2026-09-17
