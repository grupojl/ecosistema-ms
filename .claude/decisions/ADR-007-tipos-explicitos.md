# ADR-007 — Tipos explicitos: sin `as any` , `as unknown as`, toOutput() en services

**Estado:** Implementado parcialmente — DTOs y tipos de salida completos
**Fecha:** 2024-Q4

## Decision

Sin capa repository, el equivalente de `toEntity()` de welver es
`toOutput()` en services + tipos de salida explícitos en `types/`.

## Completado

- [x] `chatia-backend/src/contacts/dto/update-contact.dto.ts` — contenido real (estaba vacio)
- [x] `chatia-backend/src/contacts/dto/list-contacts.dto.ts` — extraido de contacts.service.ts
- [x] `chatia-backend/src/agents/dto/register-agent.dto.ts` y `update-agent.dto.ts`
  — extraidos de agents.controller.ts donde estaban inline
- [x] `chatia-backend/src/conversations/types/conversation.types.ts`
  — `ConversationOutput`, `ConversationListOutput`
- [x] `chatia-backend/src/contacts/types/contact.types.ts`
  — `ContactOutput`, `ContactStatsOutput`
- [x] `pasarelapagos-backend/src/modules/payments/types/payment.types.ts`
  — `PaymentOutput`, `PaymentListOutput`, `RefundOutput`
- [x] `notificaciones-backend/src/notifications/dlq/chatia-internal.interface.ts`
  — tipado correcto del cliente gRPC (elimina el @ts-expect-error)
- [x] `pasarelapagos-backend/src/modules/audit/JSONB-CASTS.md`
  — documenta el cast temporal y los JSONB reales con `// @ecosistema-ms/jsonb-cast`

## Pendiente

- [ ] Conectar los tipos en los services (conversations, contacts, payments
  deben importar sus tipos de `types/` y agregar los metodos `toOutput()`)
- [ ] Audit completo de DTOs inline restantes:
  `grep -rn "export class.*Dto" */src/**/*.service.ts`
- [ ] Marcar todos los campos JSONB con `// @ecosistema-ms/jsonb-cast`
- [ ] Agregar ESLint `no-explicit-any` en S3

## Excepcion documentada

`// @ecosistema-ms/jsonb-cast` — unica excepcion aceptada para campos `Json` de Prisma.
Sin ese comentario, cualquier cast es bloqueante en code review.

## Diferencia con welver ADR-007

| welver | ecosistema-ms |
|--------|--------------|
| `toEntity()` en repositories | `toOutput()` en services |
| Excepcion: `// @real/jsonb-cast` | Excepcion: `// @ecosistema-ms/jsonb-cast` |
