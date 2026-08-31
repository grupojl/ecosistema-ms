# Sprints — ecosistema-ms (post cierre ADR-003/005/006/007)

## Estado actual del repo

5 microservicios con codigo de produccion funcional.
ADR-003, ADR-005, ADR-006 cerrados en codigo — 4 pasos manuales pendientes.
ADR-007 parcialmente conectado — tipos creados, services sin conectar.
0 tests en todo el repo.

## Sprint actual — S1: Completar pasos manuales de los ADRs cerrados

Estas 6 tareas son de bajo riesgo y alto impacto — desbloquean lo que ya esta codificado:

- [ ] `pnpm add opossum --filter chatia-backend --filter notificaciones-backend` (DT-004a)
- [ ] `cd workers-backend && pnpm prisma migrate dev --name add_campaign_recipient` (DT-003)
- [ ] Conectar `DlqModule` en `chatia-backend/src/queue/queue.module.ts` (DT-015)
- [ ] Registrar `CircuitBreakerService` en `NotificationsModule` (DT-004b)
- [ ] `AssistantChatService` captura `CircuitOpenError` → fallback (DT-004c)
- [ ] `dlq-monitor.service.ts` reemplaza `@ts-expect-error` por `firstValueFrom` (DT-008)

Adicionalmente en S1:
- [ ] Fix `start:migrate` en chatia: `prisma migrate deploy && node dist/main.js` (DT-013)
- [ ] Eliminar `AnalyticsModule` deprecated de chatia (DT-011)
- [ ] Audit TenantGuard: `grep -rL "TenantGuard" */src/**/*.controller.ts` (DT-006)

## S2: Conectar toOutput() + Testing Fase 1

### toOutput() en services (ADR-007 cierre final)
- [ ] `conversations.service.ts` — `toConversationOutput()` + importar `ConversationOutput`
- [ ] `contacts.service.ts` — `toContactOutput()` + eliminar clases inline
- [ ] `payments.service.ts` — tipar `serialize()` con `PaymentOutput`
- [ ] Audit final: `grep -rn "export class.*Dto" */src/**/*.service.ts`
- [ ] Marcar JSONB con `// @ecosistema-ms/jsonb-cast`

### Testing Fase 1 — de 3.0 a 6.0 (ver checklist completo)
Prioridad por impacto economico:
1. `routing.service.spec.ts` + `circuit-breaker.service.spec.ts` (pagos)
2. `notification.processor.spec.ts` + `idempotency.helper.spec.ts`
3. `assistant-chat.service.spec.ts` + `assignment.service.spec.ts`
4. `projections.service.spec.ts` + `campaigns.service.spec.ts`

## S3: CB completo + Observabilidad basica

- [ ] CB en `OutgoingMessageProcessor` de chatia por channelType
- [ ] `nestjs-pino` en chatia, analytics, notificaciones, workers
- [ ] `correlationId` cross-service en `@ecosistema-ms/auth-server`
- [ ] Metricas Prometheus reales en todos los MS
- [ ] `accessToken` de ChannelAccount cifrado at-rest (DT-007)
- [ ] Integration tests Supertest para contratos HTTP criticos

## S4: Testing 85% + Observabilidad completa

- [ ] `coverageThreshold: { lines: 85 }` en jest config de todos los MS
- [ ] GitHub Actions: bloquear PR si cobertura baja del 85%
- [ ] OpenTelemetry tracing distribuido
- [ ] Dashboard Grafana con metricas unificadas
- [ ] Alertas: DLQ, CB state, error rate, latencia LLM

## S5: Hardening

- [ ] mTLS entre microservicios en Railway
- [ ] Versioning semantico de protos
- [ ] Load testing de payments con k6
