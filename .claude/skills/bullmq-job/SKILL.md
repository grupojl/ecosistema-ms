---
name: bullmq-job
description: Crear o modificar una cola/job/processor de BullMQ en un microservicio — idempotencia, jobId determinista, reintentos, DLQ, registro de la cola, processor, tests y contrato. Usar cuando el usuario pida "agregar un job", "encolar X", "nuevo processor", "cola de ...", o cuando un cambio toque archivos de queue/ o @Processor.
---

# bullmq-job

Base: `checklists/nuevo-job-bullmq.md`, `contracts/bullmq-queues.md`. Ejemplo vivo y completo en chatia:
`infrastructure/queue/processors/auto-reply.processor.ts`, `infrastructure/queue/queue.constants.ts`,
`infrastructure/queue/outgoing-job.ts` y el productor en `core/conversations/conversations.service.ts`.

## 1. Diseño (decidir antes de escribir)
- **Idempotencia**: el mismo job N veces produce el mismo resultado. Chequear el estado antes de la operación
  (ej.: `alreadyReplied` antes de responder; `updateMany ... where status: 'PENDING'`).
- **`jobId` determinista** para jobs críticos (`reply_<messageId>`, `send_<messageId>`; **nunca `:`**: BullMQ rechaza ids con `:` salvo que tengan 3 partes). Sin eso, un webhook reenviado duplica el trabajo.
  Excepción justificada: reindexar necesita `jobId` único por solicitud (si no, BullMQ lo ignora mientras el anterior siga guardado).
- **Reintentos**: `attempts: 3` + `backoff: { type: 'exponential', delay: 2000 }`; `removeOnComplete: 100`, `removeOnFail: 200`.
- **¿Necesita DLQ?** pagos y notificaciones críticas → sí (ver `infrastructure/queue/dlq/`).
- **Payload mínimo y seguro**: ids + lo estrictamente necesario, **con `organizationId`**. Los secretos viajan como están en la base
  (cifrados) y se abren recién al ejecutar (ver `outgoing-message.processor.ts`).
- Si el job llama a un proveedor externo: la falla **no escala a un humano** (ver skill `provider-adapter`).

## 2. Implementación
1. Constante en `queue.constants.ts` (`QUEUES.X`, `JOBS.X`).
2. Registrar la cola donde se **produce** (`BullModule.registerQueue({ name })`) y en `QueueModule` donde se **consume**.
3. Processor en `infrastructure/queue/processors/`: `extends WorkerHost`, `@Processor(QUEUES.X)`, `process(job)` **delega en un service de `core/`**
   (el processor no tiene lógica de negocio), `@OnWorkerEvent('failed')` con log estructurado (tolerar `job` indefinido) y `completed` si aporta.
4. Registrarlo en `QueueModule` **solo con `REDIS_ENABLED`**.
5. Productor: encolar con opciones explícitas; si Redis está apagado, el productor debe degradar (cola opcional `@Optional()`), no romper.
6. Un único helper para armar el payload si hay más de un productor (evita que uno omita campos: pasó con el envío manual).

## 3. Tests
- Processor con `job` mock: delega, propaga el error (para que BullMQ reintente), `onFailed` no lanza.
- Productor: encola con el `jobId` esperado; **no** encola un duplicado; respeta el interruptor de apagado.
- Idempotencia: ejecutar dos veces → un solo efecto (unit + **integración con Postgres real** si escribe en DB).
- Cola mockeada: `{ provide: getQueueToken(QUEUES.X), useValue: { add: jest.fn() } }`.
- **Lo que los mocks no prueban**: BullMQ con Redis real → anotarlo como pendiente hasta el smoke test (`deploy-railway`).

## 4. Documentación
- Agregar el job a la tabla de `contracts/bullmq-queues.md`.
- Si es una cola nueva consumida por otro servicio, anotarlo en el `services/<svc>.md` de ambos.

## Prohibido
- `jobId` aleatorio en jobs críticos · lógica de negocio en el processor · `console.log` · jobs que reintentan sin ser idempotentes.
