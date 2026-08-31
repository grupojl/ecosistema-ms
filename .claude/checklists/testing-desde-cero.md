# Checklist: Testing — de 3.0 a 8.5/10

**Score actual: 3.0/10** — 0 tests encontrados en el repo
**Score objetivo: 8.5/10 — nivel Stripe / Linear**

## Por que es la deuda mas urgente

Sin tests, cada deploy es una apuesta. Con 5 MS + gRPC + BullMQ, un bug en
RoutingService o NotificationProcessor puede costar dinero real.

## Fase 1 — Quick wins (1 sprint) -> de 3.0 a 6.0

### pasarelapagos-backend (mayor impacto economico)
- [ ] routing.service.spec.ts — selectProvider() con CB abierto -> fallback
- [ ] routing.service.spec.ts — todos los CB abiertos -> excepcion NoProvider
- [ ] circuit-breaker.service.spec.ts — estado closed -> open -> half-open
- [ ] reconciliation.service.spec.ts — reconcileOne() PENDING -> COMPLETED
- [ ] reconciliation.service.spec.ts — reconcileOne() ya COMPLETED -> skip
- [ ] payment-state.machine.spec.ts — transiciones validas e invalidas
- [ ] api-key.service.spec.ts — create, verify, revoke

### notificaciones-backend (segundo en impacto)
- [ ] notification.processor.spec.ts — dedup: idempotencyKey existente -> SKIPPED
- [ ] notification.processor.spec.ts — opt-out check -> SKIPPED
- [ ] notification.processor.spec.ts — fallo de adapter -> reintento BullMQ
- [ ] idempotency.helper.spec.ts — misma key en ventana -> duplicado detectado
- [ ] dlq-monitor.service.spec.ts — threshold no alcanzado -> sin alerta
- [ ] dlq-monitor.service.spec.ts — threshold superado -> alerta enviada

### chatia-backend
- [ ] assignment.service.spec.ts — round-robin con N agentes
- [ ] assignment.service.spec.ts — least-load selecciona el menos cargado
- [ ] assistant-chat.service.spec.ts — low confidence -> FAQ fallback activado
- [ ] faq-ingestion.processor.spec.ts — doc ya indexado (mismo hash) -> skip
- [ ] analytics-events.service.spec.ts — track() falla silenciosamente sin romper el caller

### analytics-backend
- [ ] projections.service.spec.ts — lock Redis tomado -> skip
- [ ] projections.service.spec.ts — lock libre -> corre y libera
- [ ] sse.service.spec.ts — MAX_SSE_CONNECTIONS alcanzado -> rechaza conexion

### workers-backend
- [ ] campaigns.service.spec.ts — lock activo -> scheduler no corre dos veces
- [ ] campaigns.service.spec.ts — campana en RUNNING -> no se re-encola
- [ ] jobs.service.spec.ts — getStats() agrega correctamente todos los queues

## Fase 2 — Integration tests (1 sprint) -> de 6.0 a 8.0

- [ ] Supertest: POST /payments -> 201 con idempotencyKey -> segunda llamada -> 200 mismo pago
- [ ] Supertest: POST /payments sin auth -> 401
- [ ] Supertest: POST /payments con ecosystemId ajeno -> 403
- [ ] Supertest: GET /health -> 200 con checks de DB y Redis
- [ ] gRPC test: AnalyticsService.TrackEvent -> evento persistido en DB
- [ ] gRPC test: PagosService.CreatePaymentIntent -> devuelve payment_id

## Fase 3 — Coverage gate CI (S3) -> de 8.0 a 8.5

- [ ] coverageThreshold en jest config: lines: 85 en paths criticos
- [ ] GitHub Actions: bloquear PR si cobertura baja del 85% en payments/, notifications/
- [ ] coveragePathIgnorePatterns: excluir *.module.ts, *.dto.ts, main.ts

## Patron base para todos los tests de service

```typescript
import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        { provide: getQueueToken(QUEUE_RECONCILE), useValue: { add: jest.fn() } },
        { provide: RoutingService, useValue: { selectProvider: jest.fn() } },
      ],
    }).compile();
    service = module.get(PaymentsService);
    prisma  = module.get(PrismaService);
  });
});
```

## TenantContext mock canonico (usar en todos los tests)

```typescript
const mockCtx = {
  ecosystemId:    'test-ecosystem',
  organizationId: 'test-org-id',
  userId:         'firebase-uid-123',
  role:           'ADMIN' as const,
};
```

## Dependencia a agregar

```bash
pnpm add -D jest-mock-extended --filter pasarelapagos-backend
pnpm add -D jest-mock-extended --filter chatia-backend
pnpm add -D jest-mock-extended --filter notificaciones-backend
pnpm add -D jest-mock-extended --filter analytics-backend
pnpm add -D jest-mock-extended --filter workers-backend
```
