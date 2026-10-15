# chatia-backend — Plan para llegar a 10/10 en producción

> Fecha: 2026-10-14 · Estado: **PENDIENTE DE APROBACIÓN**
> Base: auditoría de código del 2026-10-14 (solo lectura, sin ejecutar contra DB/Redis). Nota de partida: **4,1 / 10**.
> Complementa `deuda-tecnica.md` y `infrastructure/providers-fallback.md`.

## Qué significa 10/10

Un área está en 10 cuando se cumplen las tres cosas: (1) el comportamiento correcto está implementado,
(2) hay un test automático que falla si se rompe, (3) se verificó contra servicios reales (DB, Redis,
Meta, proveedores), no solo con mocks. Nada se marca como hecho sin esa verificación.

## Resumen de fases

| Fase | Objetivo | Áreas | Nota al cerrar | Esfuerzo |
|---|---|---|---|---|
| **F0** Bloqueantes | Nada explotable ni roto al salir | 1, 2, 3 | ~6,2 | 2–3 días |
| **F1** Confianza | Se puede probar y medir | 4, 5 | ~7,5 | 3–4 días |
| **F2** Datos y aislamiento | Datos correctos y separados | 6, 7 | ~8,5 | 3–4 días |
| **F3** Operación | Se opera sin sorpresas | 8, 9, 10 + extras | ~9,5 | 4–5 días |
| **F4** Excelencia | Cierra el último punto | cobertura, carga, runbooks | **10** | 3–4 días |

Cada fase termina con un commit verificado y la nota se recalcula con la misma tabla de pesos.

---

## F0 — Bloqueantes de seguridad (P0)

### F0.1 Autenticidad de webhooks de Meta · área 1 (peso 20%) · hoy 2 → 10
**Problema:** `webhooks.service.ts:54` solo verifica la firma `if (signature)`; sin header pasa todo.
Además `main.ts` no activa `rawBody` (se firma un buffer vacío) y se usa `webhookVerifyToken`
como secreto en vez del App Secret de Meta. Resultado: los mensajes reales se rechazan y los falsos pasan.

**Cambios**
- `main.ts`: `NestFactory.create(AppModule, { bufferLogs: true, rawBody: true })`.
- `webhooks.service.ts`: firma **obligatoria** en POST (sin header → 401). Secreto = App Secret
  (`META_APP_SECRET`, o por cuenta si cada org usa su propia app de Meta). Comparación con `timingSafeEqual` (ya existe).
- Verificar el prefijo/forma de firma de cada canal (WhatsApp/Instagram/Messenger usan `x-hub-signature-256`;
  TikTok es distinto: confirmar contra su doc antes de dar el canal por bueno).
- Rechazar payloads sin `rawBody` disponible.
- Idempotencia: ya hay `jobId` por mensaje; agregar test de reenvío duplicado.

**Aceptación:** test unitario (firma válida pasa, inválida/ausente/vacía da 401), y prueba real con la
herramienta de prueba de webhooks de Meta (o un POST firmado a mano) contra un entorno de staging.

### F0.2 Endpoints públicos del widget · área 2 (peso 15%) · hoy 3 → 10
**Problema:** `POST /widget/:slug/chat` llama al LLM sin auth ni límite; `userId` lo manda el cliente;
`GET .../session/:userId` devuelve historial sin autenticación. No hay `helmet` ni rate limit en el servicio.

**Cambios**
- `@nestjs/throttler` global (por IP) con límites más estrictos en `/widget/*` y `/webhooks/*`; Redis como store
  para que valga con varias réplicas.
- Sesión del widget con **token firmado** emitido por el servidor (JWT corto o cookie firmada) en el primer
  mensaje; el `userId` deja de venir del cliente. `GET session` exige ese token.
- Cuota diaria de mensajes por organización/proyecto del widget (tope de costo de LLM), configurable.
- Límite de tamaño de mensaje (hoy sin tope explícito) y de cuerpo HTTP.
- CORS del widget por organización (`allowedOrigins` en la config del proyecto), no el global.
- `helmet` con CSP razonable; en el snippet JS, escapar `\`, saltos de línea y `</script>` en
  `personaName`/`welcomeMessage` (hoy solo se escapa `'`).
- Captcha/Turnstile opcional si se detecta abuso (dejar el gancho, no implementarlo ahora).

**Aceptación:** tests de límites (429 al exceder), de sesión (token ajeno → 403), y prueba de carga ligera
con k6 mostrando que el límite corta antes de llamar al LLM.

### F0.3 Autenticación y entorno · área 3 (peso 10%) · hoy 5 → 10
**Problema:** el `TenantGuard` acepta cualquier `x-organization-id` sin Firebase si `NODE_ENV !== 'production'`,
y la validación de env deja `NODE_ENV` por defecto en `development`. Swagger queda público.

**Cambios**
- `validation.schema.ts`: `NODE_ENV` **obligatorio** (sin default). Arranque falla si falta.
- Bypass de desarrollo solo con flag explícito `ALLOW_DEV_AUTH=true`, y el arranque falla si ese flag está
  activo junto con `NODE_ENV=production`.
- Swagger solo si `SWAGGER_ENABLED=true`, nunca en producción.
- `PLATFORM_ADMIN_KEY` e `INTERNAL_API_KEY`: comparar con `timingSafeEqual`, exigirlas en el arranque en producción
  y rechazar si están vacías.
- Validar al arrancar todas las claves requeridas en producción (`META_APP_SECRET`, `FIREBASE_*`, etc.).
- Rotar `GROQ_API_KEY` (apareció en una salida de esta sesión) y auditar que ningún `.env` esté versionado.

**Aceptación:** tests del guard (producción sin Firebase → 401, dev sin flag → 401), y arranque que falla
con mensajes claros cuando falta una variable.

---

## F1 — Confianza (P1)

### F1.1 Tests · área 4 (peso 15%) · hoy 3 → 10
**Problema:** Jest tiene configuración duplicada (`jest.config.ts` + clave `jest` en `package.json`) y error TS5011
de `rootDir`; nunca se ejecutaron los 12 specs. El CI corre `test:cov`, así que hoy debería estar fallando.

**Cambios**
- Dejar **una** configuración de Jest, con `rootDir` correcto y alias `@/` resueltos.
- Reparar o reescribir los specs existentes hasta que pasen.
- Tests nuevos (prioridad por riesgo): webhooks (firma), widget (límites/sesión), `TenantGuard`,
  `ProviderChainService` y `LlmService` (fallo, fallback, cadena agotada), adapters (STT/TTS/imagen con
  `fetch` mockeado), `FaqQueryService` (degradación a texto), aislamiento entre tenants (extender `multitenant.spec.ts`).
- Tests de integración con Postgres y Redis reales (docker-compose de test) para: cola de entrada/salida,
  idempotencia, DLQ y `KbChunk`.
- Tests e2e (`test/app.e2e-spec.ts`) del flujo mensaje entrante → respuesta → mensaje saliente con proveedores falsos.
- Umbral de cobertura en CI: **85%** en líneas y ramas del código propio (excluye `generated/`); el CI falla por debajo.

**Aceptación:** `pnpm --filter=chatia-backend test:cov` en verde en CI y local, cobertura ≥ 85%.

### F1.2 Salud y operación · área 5 (peso 10%) · hoy 5 → 10
**Problema:** el chequeo "redis" de `/health` es otra consulta a Postgres; no hay `enableShutdownHooks`;
las imágenes Docker no están probadas con DB/Redis reales.

**Cambios**
- `/health`: ping real a Redis (`PING` con timeout) y a Postgres por separado. Separar `/health/live`
  (proceso vivo, sin dependencias) de `/health/ready` (DB + Redis; lo que usa Railway para enrutar).
- `app.enableShutdownHooks()` y cierre ordenado: dejar de aceptar webhooks, drenar workers de BullMQ
  (terminar el job en curso), cerrar gRPC y Prisma. Timeout de cierre definido.
- Smoke test real: levantar con docker-compose (Postgres + Redis + los 6 servicios), enviar un webhook firmado
  y ver el mensaje saliente. Esto cierra el pendiente P0 de `deuda-tecnica.md`.
- Pino: redactar datos personales en logs (teléfonos, tokens, `Authorization`, cuerpo de mensajes), con test.
- Métricas Prometheus: contadores por proveedor (éxitos, fallos, fallbacks usados), latencia por capacidad,
  profundidad de colas, estado de circuit breakers.
- Alertas (a equipo técnico): cadena de proveedor agotada, DLQ > umbral, circuit breaker abierto > N minutos,
  error 5xx > umbral. Definir destino (Slack/PagerDuty/email) y probar el envío.

**Aceptación:** `docker compose up` + script de smoke test en verde; cortar Redis hace que `/ready` falle
y `/live` no; `SIGTERM` durante un job no lo pierde.

---

## F2 — Datos y aislamiento (P1)

### F2.1 RAG / pgvector · área 6 (peso 5%) · hoy 4 → 10
**Problema:** no hay migración de pgvector; `KbChunk.embedding` es `Json`; la búsqueda siempre cae al modo
en memoria (carga todos los fragmentos); workers indexa con otro modelo que chatia consulta.

**Cambios**
- Migración: `CREATE EXTENSION vector`, columna `embedding vector(1024)` (dimensión de `bge-m3`), columna
  `embeddingModel`, índice HNSW (o IVFFlat) con operador coseno.
- Un único servicio de embeddings compartido: paquete `@ecosistema-ms/embeddings` o endpoint gRPC en workers.
  chatia y workers usan el **mismo modelo**; el modelo se registra por fila.
- Reindexado: job BullMQ que recalcula embeddings por base de conocimiento al cambiar de modelo (con progreso
  y reintentos), sin dejar la KB sin servicio (versión nueva en paralelo y cambio atómico).
- `FaqQueryService`: quitar el modo en memoria como camino normal; mantener solo la degradación a texto.
- Evaluación: conjunto de 30–50 preguntas reales con respuesta esperada y métrica de acierto (recall@5).

**Aceptación:** consulta con pgvector < 100 ms con 10 000 fragmentos; recall@5 medido y documentado.

### F2.2 Aislamiento multi-tenant · área 7 (peso 10%) · hoy 6 → 10
**Problema:** las consultas filtran por `organizationId`; tu regla dura exige `ecosystemId`. `messages.service.ts`
resuelve la conversación por organización (bien) pero el resto no es uniforme.

**Cambios**
- Auditar cada `findMany/findFirst/update/delete` de los 16 archivos y exigir `ecosystemId` + `organizationId`.
- Centralizar: un wrapper/extensión de Prisma que inyecte el filtro de tenant por defecto y falle si falta
  (más seguro que revisar a mano). Opcional: Row-Level Security en Postgres como segunda barrera.
- Test automático que recorre los repositorios con dos tenants y verifica que ninguno ve datos del otro
  (extender `src/test/multitenant.spec.ts`).
- Lint custom o regla de CI que marque `findMany` sin `where` de tenant.

**Aceptación:** suite de aislamiento en verde; intento deliberado de leer datos de otro tenant falla en todos los endpoints.

---

## F3 — Operación sin sorpresas (P2)

### F3.1 Proveedores externos · área 8 (peso 5%) · hoy 8 → 10
- Verificar con claves reales los ids de modelo de SiliconFlow (`gpt-oss-120b`, `Qwen3-VL-32B`, `bge-m3`),
  JSON mode, latencia frente al timeout de 15 s y calidad en español.
- Confirmar que Groq Scout acepta imágenes y comparar contra Haiku con 20–30 imágenes reales (DNI, facturas).
- ElevenLabs: confirmar que `opus_48000_64` entrega Ogg/Opus aceptado por WhatsApp; si no, conversión con ffmpeg.
- Voz a texto de SiliconFlow: elegir modelo tras probar español; si no sirve, dejarla deshabilitada.
- Revisar términos y retención de datos de SiliconFlow (proveedor en China) antes de mandar datos de ciudadanos.
- Prueba de caos: apagar cada proveedor y comprobar que la cadena responde con el siguiente y que, con todos caídos,
  el usuario recibe el mensaje de reintento y **no** se emite escalado.

### F3.2 Limpieza de código · área 9 (peso 5%) · hoy 7 → 10
- Borrar `*.bak`, `app.module.ts.bak*`, `_deprecated/`, `Dockerfile.bak`, `x`, `x.sh`, `chat-ia-back.xml` si no se usan.
- `manzana`/`mexus`: quitar las plantillas con `TODO` o completarlas; no dejar prompts con "TODO" en producción.
- Unificar `GroqService` (sin uso real) o eliminarlo; limpiar `GROQ_MODELS` obsoleto en `SETUP.md`.
- ESLint en CI con `--max-warnings 0`; sin `any`, sin imports relativos (ya se cumple; agregar regla para que no vuelva).
- Actualizar `README.md`/`SETUP.md` y `providers-fallback.md` con lo implementado.

### F3.3 Funcionalidad pendiente · área 10 (peso 5%) · hoy 5 → 10
- Voz por organización: leer voice ids (Cartesia/ElevenLabs) de la config de cada org (`multimodal.service.ts:89`);
  flujo para clonar y registrar la voz.
- Mensaje de "servicio caído" configurable por org (sin que pueda parecer un handoff).
- Cola persistente de salida con idempotencia y recuperación de webhooks perdidos (reconciliación contra la API de Meta).
- Monitoreo de calidad de número y límites de mensajería de Meta, con alerta técnica.
- Meta Graph API: confirmar versión vigente y pasarla a variable de configuración.

---

## F4 — Excelencia (cierra el último punto)

- **Pruebas de carga** (k6): objetivo definido, por ejemplo 50 mensajes/s sostenidos y p95 < 3 s de punta a punta;
  identificar cuellos (pool de Prisma, BullMQ concurrency, límites de proveedores).
- **Backups y recuperación:** backups automáticos de Postgres, prueba de restauración documentada, **RTO/RPO**
  definidos para chatia (pendiente "Escalón 9").
- **Runbooks** en `.claude/`: webhook rechazado, proveedor caído, DLQ llena, número de Meta degradado, reindexado.
- **Seguridad extra:** `pnpm audit` y Trivy sin altas/críticas, SBOM, firma de imágenes (ya hay Cosign), rotación de secretos
  documentada, defensa básica contra prompt injection (no ejecutar acciones ni revelar el system prompt, test con casos).
- **Privacidad:** retención de mensajes y borrado por solicitud del titular, enmascarado de datos personales
  antes de enviarlos a proveedores cuando sea posible.
- **Branch protection en `main`** (manual en GitHub): CI obligatorio, revisión requerida.
- **Presupuesto de costo:** tablero de gasto por proveedor y por organización, con alerta al superar el tope.

---

## Decisiones que necesito de vos antes de implementar

1. **Firma de webhooks:** ¿cada organización usa su propia app de Meta (secreto por cuenta) o hay una sola app de plataforma (`META_APP_SECRET`)?
2. **Widget:** ¿token de sesión por JWT corto o cookie firmada? ¿Qué cuota diaria por proyecto te parece razonable (ej. 500 mensajes)?
3. **Alertas técnicas:** ¿a dónde van (Slack, email, PagerDuty)? Hoy solo hay logs.
4. **Reindexado y embeddings:** ¿confirmás `bge-m3` por SiliconFlow? Implica enviar texto de las FAQ a un proveedor en China.
5. **Row-Level Security** en Postgres como segunda barrera: ¿sí o solo el filtro en código?
6. **Objetivo de carga** (mensajes/s) y **RTO/RPO** que querés prometer.
7. **Alcance de manzana/mexus:** ¿se completan ahora o se quitan hasta que haya cliente?

## Riesgos y dependencias

- F0.1 requiere acceso a Meta (herramienta de prueba de webhooks o una cuenta de sandbox).
- F1.1 y F1.2 necesitan Postgres y Redis reales (docker-compose); sin ellos la nota no pasa de ~7.
- F2.1 necesita la extensión `vector` disponible en el Postgres de Railway (verificar antes de migrar).
- F2.1 toca `workers-backend`: se coordina con su propio plan, no es solo chatia.
- Los porcentajes de nota son una estimación mía con los pesos de la tabla; se recalculan al cerrar cada fase.

## Orden recomendado

`F0.3 → F0.1 → F0.2` (de menor a mayor esfuerzo, todo seguridad) → `F1.1` (para respaldar lo anterior con tests)
→ `F1.2` → `F2.2` → `F2.1` → `F3.*` → `F4`.
