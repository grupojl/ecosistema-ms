# Capa 2 — Contratos HTTP: DTOs, validacion, superficie publica
# Checklist 10/10

**Score actual: 6.5/10 — nivel startup escala**
**Score objetivo: 10/10 — nivel Stripe API**

## Completado

- [x] `class-validator` en DTOs de entrada — validacion en la frontera
- [x] `ValidationPipe` global en `main.ts` de todos los MS
- [x] DTOs separados en `dto/` en la mayoria de modulos
- [x] Swagger documentado en main.ts con `DocumentBuilder`
- [x] `@ApiTags`, `@ApiBearerAuth` en controllers principales
- [x] pasarelapagos: DTOs con `@ApiProperty` completo (nivel de referencia)
- [x] `class-transformer` configurado — `transform: true` en ValidationPipe

## Pendiente para 10/10

### DTOs dentro de services — DT-009 (S1 — BLOQUEANTE)
- [ ] `chatia-backend/src/ai-config/ai-config.service.ts`
  Mover `UpdateAiConfigDto` a `ai-config/dto/update-ai-config.dto.ts`
  (ya existe el archivo — el DTO esta duplicado)
- [ ] `chatia-backend/src/contacts/contacts.service.ts`
  Mover `UpdateContactDto` y `ListContactsDto` a `contacts/dto/`
- [ ] Verificar si hay mas services con DTOs inline:
  `grep -rn "export class.*Dto" */src/**/*.service.ts`

### `@ApiOperation` y `@ApiResponse` en todos los endpoints (S2)
- [ ] chatia-backend: la mayoria de controllers no tienen `@ApiOperation`
- [ ] notificaciones-backend: idem
- [ ] analytics-backend: idem
- [ ] workers-backend: idem
- [ ] Referencia: pasarelapagos-backend tiene el nivel correcto de documentacion

### Tipos de retorno explicitos en services (ADR-007 — S2)
- [ ] `conversations.service.ts` — retorna tipo Prisma crudo al controller
- [ ] `contacts.service.ts` — idem
- [ ] `payments.service.ts` — parcialmente tipado, completar
- [ ] Ver ADR-007 para el patron `toOutput()` completo

### Enforcement CI (S3)
- [ ] ESLint rule: clase con sufijo `Dto` fuera de directorio `dto/` = warning
- [ ] `@nestjs/swagger` check: endpoint sin `@ApiOperation` en controllers publicos

## Regla dura

Un DTO nuevo definido dentro de un service es un bug de organizacion.
Los DTOs viven en `dto/` — siempre. Un type de retorno `Promise<any>` en
un service que expone datos al controller es un bug de Capa 2.
