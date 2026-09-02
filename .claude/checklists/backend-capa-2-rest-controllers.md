# Backend Capa 2 — Validación de entrada REST (Zod)
# Checklist 10/10

**Score actual: 2/10 — BLOQUEANTE ACTIVO**
**Score objetivo: 10/10**

## ❌ Bloqueante actual

Todos los microservicios usan `class-validator` DTOs. Ver ADR-001.

## ✅ Completado

- [x] ADR-001 documentado — decisión tomada: Zod inline en controllers REST
- [x] Los controllers gRPC no requieren Zod (protobuf valida el transporte)

## ⏳ Pendiente para 10/10

### Infraestructura Zod (hacer PRIMERO)
- [ ] Crear `ZodValidationPipe` global en cada servicio
  ```ts
  // src/common/pipes/zod-validation.pipe.ts
  import { PipeTransform, BadRequestException } from '@nestjs/common';
  import { ZodSchema } from 'zod';
  export class ZodValidationPipe implements PipeTransform {
    constructor(private schema: ZodSchema) {}
    transform(value: unknown) {
      const result = this.schema.safeParse(value);
      if (!result.success) throw new BadRequestException(result.error.format());
      return result.data;
    }
  }
  ```
- [ ] Crear filtro global `ZodExceptionFilter` → convierte `ZodError` en 400 tipado
- [ ] Agregar en `main.ts` de cada servicio

### Migración DTOs — chatia-backend (15+ DTOs)
- [ ] `agents/dto/register-agent.dto.ts` → Zod inline en `agents.controller.ts`
- [ ] `contacts/dto/create-contact.dto.ts` → Zod inline en `contacts.controller.ts`
- [ ] `contacts/dto/list-contacts.dto.ts` → Zod inline en `contacts.controller.ts`
- [ ] `contacts/dto/update-contact.dto.ts` → Zod inline en `contacts.controller.ts`
- [ ] `conversations/` → Zod inline (sin DTO visible — verificar)
- [ ] `ecosystem/dto/register-ecosystem.dto.ts` → Zod inline
- [ ] `faq/document/dto/kb-document.dto.ts` → Zod inline
- [ ] `faq/knowledge-base/dto/knowledge-base.dto.ts` → Zod inline
- [ ] `faq/query/dto/faq-query.dto.ts` → Zod inline
- [ ] `messages/dto/create-message.dto.ts` → Zod inline
- [ ] `messages/dto/update-message.dto.ts` → Zod inline
- [ ] `projects/dto/create-project.dto.ts` → Zod inline
- [ ] `projects/dto/update-project.dto.ts` → Zod inline
- [ ] `webhooks/dto/create-webhook.dto.ts` → Zod inline
- [ ] `webhooks/dto/update-webhook.dto.ts` → Zod inline
- [ ] `assistant/dto/chat.dto.ts` → Zod inline
- [ ] `assistant/config/dto/assistant-config.dto.ts` → Zod inline
- [ ] `ai-config/dto/update-ai-config.dto.ts` → Zod inline
- [ ] `internal/dto/internal-chat.dto.ts` → Zod inline
- [ ] `modules/manzana/dto/enrich-context.dto.ts` → Zod inline
- [ ] `modules/mexus/dto/enrich-context.dto.ts` → Zod inline
- [ ] `modules/welver/dto/enrich-context.dto.ts` → Zod inline
- [ ] `queue/` — verificar si tiene DTOs

### Migración DTOs — pasarelapagos-backend
- [ ] `modules/payments/dto/create-payment.dto.ts` → Zod inline
- [ ] `modules/payments/dto/list-payments.dto.ts` → Zod inline

### Migración DTOs — workers-backend
- [ ] `campaigns/dto/campaign.dto.ts` → Zod inline
- [ ] `jobs/dto/campaign-email-job.dto.ts` → Zod inline en processor/service
- [ ] `jobs/dto/vector-index-job.dto.ts` → Zod inline en processor/service

### Migración DTOs — notificaciones-backend + analytics-backend
- [ ] Verificar si existen DTOs no visibles en el packing — grep en código fuente

### Cleanup final
- [ ] Eliminar `class-validator` y `class-transformer` de todos los package.json
- [ ] Eliminar las carpetas `dto/` vacías

## Regla dura

Un DTO nuevo con `class-validator` en código post-migración es un bug de arquitectura.
Todo input nuevo = schema Zod colocado inline en el controller REST.
Los controllers gRPC quedan exentos — protobuf es su contrato.
