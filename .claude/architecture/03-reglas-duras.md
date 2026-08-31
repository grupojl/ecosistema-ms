# Reglas Duras — ecosistema-ms

Cada regla tiene su enforcement. Sin enforcement una regla es una sugerencia.

---

## TypeScript

### `any` implicito o explicito = bug de diseno, se bloquea en PR

```typescript
// BLOQUEANTE — nunca
const result = await this.prisma.conversation.findMany() as any;
function process(data: any) { ... }

// CORRECTO
const result = await this.prisma.conversation.findMany();
// El tipo es inferido por Prisma — no necesita cast
```

**Enforcement S3:**
- ESLint `@typescript-eslint/no-explicit-any` en strict mode
- ESLint `@typescript-eslint/no-unsafe-assignment`
- Falla el build si hay `as any` sin comentario `// @ecosistema-ms/jsonb-cast`

### `as unknown as X` en services o controllers = bug de diseno

La unica excepcion permitida es en campos JSONB de Prisma, marcados con
`// @ecosistema-ms/jsonb-cast`. Sin ese comentario, el cast es bloqueante.

```typescript
// BLOQUEANTE
return result as unknown as PaymentOutput;

// CORRECTO — mapper explicito
private toPaymentOutput(row: Prisma.PaymentGetPayload<{}>): PaymentOutput {
  return {
    id:       row.id,
    status:   row.status,
    amount:   Number(row.amountMinor),
    currency: row.currency,
  };
}

// UNICA excepcion aceptada — campos JSONB de Prisma
const perms = row.payload as PayloadType; // @ecosistema-ms/jsonb-cast
```

Ver ADR-007 para el patron completo.

### DTOs no deben definirse dentro de services

```typescript
// BLOQUEANTE — encontrado en ai-config.service.ts y contacts.service.ts
export class UpdateAiConfigDto { ... } // dentro del service

// CORRECTO — DTO en su propio archivo
// ai-config/dto/update-ai-config.dto.ts
export class UpdateAiConfigDto { ... }
```

**Enforcement S3:**
- ESLint rule: clase con sufijo `Dto` fuera de `dto/` = warning bloqueante

---

## Prisma / DB

### N+1 = error, no warning

Toda query que cargue relaciones usa `include` o `select` explicito.

```typescript
// BLOQUEANTE
const convs = await this.prisma.conversation.findMany({ where });
for (const c of convs) {
  const msgs = await this.prisma.message.findMany({ where: { conversationId: c.id } });
}

// CORRECTO
const convs = await this.prisma.conversation.findMany({
  where,
  include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
});
```

**Enforcement S3:**
- dependency-cruiser rule que detecta `prisma.X.findMany` dentro de un loop
- Code review manual hasta entonces

### Toda query lleva `ecosystemId` + `organizationId`

```typescript
// BLOQUEANTE — filtro incompleto
this.prisma.conversation.findMany({ where: { organizationId } });

// CORRECTO
this.prisma.conversation.findMany({
  where: { ecosystemId, organizationId },
});
```

**Enforcement S3:**
- ESLint rule `@ecosistema-ms/no-unscoped-prisma-query`
  Detecta `findMany/findFirst/findUnique` sin `ecosystemId` en el `where`
  Excepcion: tablas globales (`Ecosystem`, `WebhookInbound`)

### Migrations solo via Prisma — nunca SQL manual

```bash
# Local
pnpm prisma migrate dev --name descripcion_breve

# CI/Railway — en start:migrate
prisma migrate deploy && node dist/main.js
```

Nota: chatia-backend tiene `"start:migrate": "prisma migrate deploy"` sin
`&& node dist/main.js` — esto es DT-013, el servicio no levanta tras migrar.

---

## Seguridad

### `TenantGuard` en TODAS las rutas autenticadas — sin excepcion

```typescript
// BLOQUEANTE — controller sin guard
@Controller('conversations')
export class ConversationsController { ... }

// CORRECTO
@Controller('conversations')
@UseGuards(AuthGuard, TenantGuard)
export class ConversationsController { ... }
```

Rutas que pueden usar `@Public()` (sin guard):
- `GET /health`
- `GET /metrics`
- `POST /webhooks/{canal}` — pero verifican firma HMAC propia

**Enforcement S2 (urgente — DT-006):**
```bash
# Audit inmediato — buscar controllers sin TenantGuard
grep -rL "TenantGuard" */src/**/*.controller.ts
```

**Enforcement S3:**
- ESLint rule: `@Controller` sin `@UseGuards` que incluya `TenantGuard` = bloqueante
- Excepcion documentada: controllers con `@Public()` en todos sus metodos

### PII cifrado antes de persistir

Campos sensibles (email en Customer, datos de pago) usan `pii.service.ts`
de pasarelapagos o equivalente antes de escritura en DB. Nunca texto plano.

Excepcion conocida y documentada como DT-007:
`ChannelAccount.accessToken` en chatia — pendiente cifrar.

### Webhooks de proveedores verificados con firma HMAC antes de procesar

```typescript
// CORRECTO — verificar ANTES de cualquier logica de negocio
const event = await provider.verifyWebhook(rawBody, headers);
// Solo si no lanza -> procesar
```

El payload del webhook en DB (`WebhookInbound`) se guarda ANTES de verificar
para tener trazabilidad. La verificacion ocurre en el processor, no en el controller.

---

## BullMQ

### Todos los jobs criticos tienen `jobId` deterministico

```typescript
// BLOQUEANTE en jobs de pago o notificacion
await queue.add('process', data); // jobId aleatorio — no idempotente

// CORRECTO
await queue.add('reconcile', data, {
  jobId: `reconcile:${paymentId}`,
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
});
```

### DLQ implementada en jobs criticos

Pagos y notificaciones tienen DLQ. Workers tiene DLQ global.
Chatia tiene `IncomingMessage` y `OutgoingMessage` — pendiente DLQ (DT a abrir).

### `removeOnComplete: { count: 100 }` en jobs de alto volumen

Sin esto Redis crece sin control en queues de mensajes.

### Fire-and-forget para servicios de soporte

`AnalyticsEventsService.track()` en chatia: `attempts: 1`, sin await en path critico.
Si analytics cae, el chat continua. Ver `architecture/04-degradacion-elegante.md`.

---

## gRPC

### Solo sobre red privada Railway — nunca exponer puerto gRPC publicamente

Puertos 5001-5005 son internos. Railway no los expone al exterior por diseno.
En local: `localhost:500X`. En Railway: `{servicio}.railway.internal:500X`.

### Cambios en .proto = backward compatible o ADR

Agregar campos nuevos con numeros nuevos: OK.
Renombrar, eliminar, cambiar tipo: requiere ADR + metodo V2 + deprecation period.

---

## Deploy Railway

- Root Directory: `/` — nunca cambiar
- Dockerfile Path: `{servicio}/Dockerfile`
- Build Command: vacio — lo maneja el Dockerfile
- Health Check Path: `/health`
- start:migrate: `prisma migrate deploy && node dist/main.js`
  (no solo `prisma migrate deploy`)

---

## Lo que nunca se hace

- Acceder a la DB de otro microservicio directamente — solo via gRPC o HTTP
- Logica de negocio en controllers o processors — solo en services
- Named catalogs pnpm (`catalog:algo`) — usar `catalog:` siempre
- `console.log` en produccion — usar `Logger` de NestJS (pino en produccion)
- Secrets en codigo o en mensajes de log — solo env vars
- `as any` sin `// @ecosistema-ms/jsonb-cast`
