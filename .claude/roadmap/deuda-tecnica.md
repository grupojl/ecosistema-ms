# Deuda tecnica — lista viva (post cierre ADR-003/005/006/007)

Actualizar este archivo cada vez que se resuelve o agrega deuda.

## CRITICA — bloquea produccion confiable

### DT-001: 0 tests en todo el repositorio
Impacto: cualquier deploy es una apuesta.
Accion: ver `checklists/testing-desde-cero.md` — Fase 1 en el proximo sprint.
Archivos prioritarios: `routing.service.spec.ts`, `notification.processor.spec.ts`

### DT-002: Sin observabilidad cross-service
`nestjs-pino` solo en pasarelapagos. Sin correlationId. Sin metricas Prometheus reales.
Impacto: bugs en produccion tardan horas en diagnosticar.
Accion: ver `checklists/observabilidad.md` — Fase 1 y 2.

### DT-003: CampaignRecipient — migration pendiente de aplicar
Schema creado en codigo. La migration SQL no existe aun en la DB.
```bash
cd workers-backend && pnpm prisma migrate dev --name add_campaign_recipient
```
Hasta que corra, `CampaignRecipient` no existe en la DB real.

### DT-004a: opossum no instalado en chatia y notificaciones
El codigo usa `opossum` pero el package no esta en las deps de esos MS.
```bash
pnpm add opossum --filter chatia-backend
pnpm add opossum --filter notificaciones-backend
```
Sin esto, el build falla al arrancar.

### DT-004b: CircuitBreakerService no registrado en NotificationsModule
El servicio existe pero no esta en el providers[] del modulo — NestJS no lo inyecta.
Ver `checklists/circuit-breaker-adapters.md` paso 2.

### DT-004c: AssistantChatService sin captura de CircuitOpenError
`GroqCbService` lanza `CircuitOpenError` cuando Groq cae pero el caller
no lo captura — la excepcion llega al usuario como 500.
Ver `checklists/circuit-breaker-adapters.md` paso 3.

## ALTA — afecta estabilidad en escala

### DT-005: CERRADO — lock scheduler migrado a SET NX EX
`workers-backend/src/campaigns/campaigns.service.ts` usa `SET NX EX` Redis.
ADR-006 cerrado.

### DT-006: TenantGuard no auditado en todos los controllers
Sin evidencia de audit completo. Potencial data leak cross-tenant.
```bash
grep -rL "TenantGuard" */src/**/*.controller.ts
```

### DT-007: accessToken de ChannelAccount en texto plano en DB
`chatia-backend/prisma/schema.prisma`: `accessToken String` sin cifrar.
Los tokens de WhatsApp/IG deberian estar cifrados at-rest como el PII de pagos.

### DT-008: RESUELTO en codigo — @ts-expect-error eliminado por interface
`notificaciones-backend/src/notifications/dlq/chatia-internal.interface.ts`
provee el tipado correcto. Falta conectarlo en `dlq-monitor.service.ts`:
```typescript
// Reemplazar en dlq-monitor.service.ts:
// @ts-expect-error — rxjs interop
await this.chatiaClient.notifySystem(req).toPromise();

// Por:
await firstValueFrom(this.chatiaClient.notifySystem(req));
```

### DT-009: RESUELTO — DTOs extraidos de services
`contacts/dto/` y `agents/dto/` creados. Verificar con audit:
```bash
grep -rn "export class.*Dto" */src/**/*.service.ts
grep -rn "export class.*Dto" */src/**/*.controller.ts
```

### DT-010: Queries de conversations sin ecosystemId directo
`Conversation` no tiene `ecosystemId` directo — se accede via joins.
Auditar `conversations.service.ts` con `include` explicito.

## MEDIA — mantenibilidad

### DT-011: AnalyticsModule deprecated en chatia pendiente de eliminar
Confirmar con welver que no hay consumidores activos → eliminar el modulo.

### DT-012: Sin coverageThreshold en jest config
Agregar en todos los `package.json`:
```json
"coverageThreshold": { "global": { "lines": 85 } }
```

### DT-013: start:migrate en chatia sin node dist/main.js
```json
"start:migrate": "prisma migrate deploy"
```
Debe ser: `"prisma migrate deploy && node dist/main.js"`

### DT-014 (nuevo): toOutput() pendiente de conectar en services
Los tipos existen en `types/` pero los services aun no los usan.
Ver ADR-007 pendientes.

### DT-015 (nuevo): DlqModule no conectado en queue.module.ts de chatia
El modulo existe pero no esta importado en `queue.module.ts`.

### DT-016 (nuevo): DTO y sin Domain
¿ hace falta la capa domain + repository por que ahora tenemos dtos ?