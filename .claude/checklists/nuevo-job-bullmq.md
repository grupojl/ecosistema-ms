# Checklist: Nuevo job BullMQ

## Diseño
- [ ] ¿El job es idempotente? (misma ejecución N veces = mismo resultado)
- [ ] `jobId` determinista definido (no UUID aleatorio para jobs críticos)
- [ ] Política de reintentos definida (`attempts` + `backoff`)
- [ ] ¿Necesita DLQ? (jobs de pago, notificaciones críticas → sí)

## Implementación
- [ ] Constante de queue name en `{dominio}.constants.ts` o `queue.constants.ts`
- [ ] Queue registrada en el módulo con `BullModule.registerQueue`
- [ ] Processor extiende `WorkerHost` con `@Processor(QUEUE_NAME)`
- [ ] `@OnWorkerEvent('failed')` implementado con logging estructurado
- [ ] `@OnWorkerEvent('completed')` implementado

## Idempotencia
- [ ] Verificar estado antes de ejecutar la operación principal
- [ ] Usar transacciones Prisma si el job escribe múltiples tablas
- [ ] `removeOnComplete: { count: 100 }` en jobs de alto volumen

## Tests
- [ ] Test del processor con job mock
- [ ] Test del caso de fallo y reintento
- [ ] Queue mockeada con `{ provide: getQueueToken(QUEUE), useValue: { add: jest.fn() } }`

## Documentación
- [ ] Job agregado a la tabla en `.claude/contracts/bullmq-queues.md`
