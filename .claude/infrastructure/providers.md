# Providers — Proveedores de infraestructura

> Última actualización: 2026-10-03
> Regla: cada proveedor documenta su rol, sus límites y su estrategia de resiliencia.
> Antes de agregar un proveedor nuevo → agregar su sección aquí primero.

---

## Autenticación

### Firebase Authentication (activo)

**Rol:** proveedor principal de autenticación en todos los servicios.
**Usado en:** `packages/auth-server` · todos los microservicios via `TenantGuard`
**Métodos activos:** Firebase ID Token verificado con Firebase Admin SDK

**Flujo:**
```
Cliente → Firebase (idToken) → TenantGuard verifica con Firebase Admin SDK
       → resuelve ecosystemId por firebaseProjectId
       → valida custom claims (organizationId, role) con Zod
       → puebla TenantContext tipado → request autenticada
```

**Límites conocidos:**
- `FIREBASE_PRIVATE_KEY` requiere saltos de línea escapados (`\n`) en Railway
- Cada ecosistema (welver, manzana, mexus) tiene su propio `firebaseProjectId`
- El `TenantGuard` hace upsert pasivo del tenant — si Firebase cae, el upsert falla

**Resiliencia:**
- Circuit breaker: ⚠️ no implementado — si Firebase cae, toda la auth cae
- Fallback: 🔲 pendiente de decisión (ver sección abajo)
- Timeout configurado: no visible en el código actual

**Variables de entorno (todos los servicios):**
```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

---

### Fallback de auth (pendiente de decisión)

> Estado: 🔲 Por decidir antes del entorno de producción económica (Hetzner)

**Opciones evaluadas:**

| Opción | Pros | Contras |
|--------|------|---------|
| JWT propio (email + password) | Control total | Hay que implementar el flujo completo |
| Auth0 como proveedor secundario | Robusto, fácil de integrar | Costo adicional |
| Magic link por email (SendGrid) | Sin password, UX simple | Dependencia de SendGrid |

**Decisión:** TODO — ADR pendiente antes de llegar a producción económica.

**Lo que hay que implementar cuando se decida:**
- [ ] `IAuthProvider` — interface en `packages/auth-server`
- [ ] `FirebaseAuthAdapter` — implementación actual envuelta en la interface
- [ ] `{Fallback}AuthAdapter` — implementación del proveedor elegido
- [ ] Circuit breaker en `TenantGuard` que detecte fallo de Firebase y conmute
- [ ] Feature flag `auth.provider` para controlar el switch sin redeploy

---

## LLM / IA

### Groq + LLaMA (activo)

**Rol:** proveedor de inferencia LLM para el chat IA en `chatia-backend`
**Modelo default:** `llama-3.3-70b-versatile` (configurable por org en `AssistantConfig`)
**Usado en:** `chatia-backend` — `conversation.service.ts`

**Resiliencia:**
- Circuit breaker: ✅ implementado — `GroqCircuitBreaker` en `chatia-backend`
- Fallback: si CB abierto → responde con `AssistantConfig.fallbackMessage` + escala a humano
- Timeout: configurable por request

**Variables de entorno:**
```bash
# chatia-backend, workers-backend (embeddings)
GROQ_API_KEY=
```

**Límites conocidos:**
- Rate limits de Groq por tier — monitorear `429` responses
- El modelo por defecto puede cambiar — siempre leer de `AssistantConfig`, nunca hardcodear

---

## Base de datos

### PostgreSQL (activo)

**Rol:** base de datos principal — una instancia dedicada por microservicio.
**ORM:** Prisma con `prisma migrate deploy` en `entrypoint.sh`

**Instancias por servicio:**
| Servicio | DB |
|---------|-----|
| `chatia-backend` | `chatia_db` |
| `pasarelapagos-backend` | `pagos_db` |
| `analytics-backend` | `analytics_db` |
| `notificaciones-backend` | `notificaciones_db` |
| `workers-backend` | `workers_db` |
| `marketing-backend` | `marketing_db` |

**Resiliencia:**
- Migraciones automáticas al arrancar via `entrypoint.sh`
- Backups: 🔲 pendiente en Hetzner y AWS
- Read replicas: 🔲 roadmap para AWS (analytics-backend candidato principal)
- Índices compuestos `(organizationId, ecosystemId)`: 🔲 pendiente en todos los schemas

**Variables de entorno:**
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

---

### Redis (activo)

**Rol:** caché, BullMQ queues, pub/sub SSE, lock distribuido para scheduler
**Usado en:** todos los servicios

**Usos por servicio:**
| Servicio | Uso |
|---------|-----|
| `chatia-backend` | Rate limiting, caché de contexto |
| `pasarelapagos-backend` | Idempotencia de pagos |
| `analytics-backend` | SSE pub/sub, lock de projections |
| `workers-backend` | BullMQ queues, lock distribuido scheduler |
| `notificaciones-backend` | BullMQ queues, deduplicación |

**Resiliencia:**
- Si Redis cae: BullMQ pierde jobs en vuelo sin AOF habilitado
- Lock distribuido del scheduler: si Redis cae, múltiples instancias pueden procesar el mismo job
- AOF: 🔲 habilitar antes de Hetzner

**Variables de entorno:**
```bash
REDIS_URL=redis://user:pass@host:6379
```

> Todos los servicios usan solo `REDIS_URL` (ya no existen `REDIS_HOST/PORT/PASSWORD`).

---

## Comunicación entre servicios

### gRPC (activo)

**Rol:** comunicación inter-servicio sincrónica en la red privada de Railway
**Protocolo:** HTTP/2 · Protocol Buffers

**Mapa de puertos gRPC:**
| Servicio | Puerto gRPC |
|---------|------------|
| `chatia-backend` | 5010 |
| `pasarelapagos-backend` | 5011 |
| `notificaciones-backend` | 5013 |
| `analytics-backend` | 5012 |
| `workers-backend` | 5014 |
| `marketing-backend` | 5015 |

**URLs en Railway (red privada):**
```bash
CHATIA_GRPC_URL=chatia-backend.railway.internal:5010
PAGOS_GRPC_URL=pasarelapagos-backend.railway.internal:5011
NOTIFICACIONES_GRPC_URL=notificaciones-backend.railway.internal:5013
ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5012
WORKERS_GRPC_URL=workers-backend.railway.internal:5014
MARKETING_GRPC_URL=marketing-backend.railway.internal:5015
```

**Resiliencia:**
- Deadline helper: `deadline.helper.ts` — pendiente de verificar aplicación uniforme
- Circuit breaker por cliente gRPC: 🔲 pendiente en todos los clientes
- Retry con backoff: 🔲 pendiente
- Degradación elegante documentada: 🔲 pendiente por servicio

> Regla: antes de pasar a Hetzner, cada cliente gRPC necesita deadline + CB + retry.

---

## Pagos

### MercadoPago (activo)

**Rol:** proveedor principal LATAM
**Usado en:** `pasarelapagos-backend`
**Variables:**
```bash
MERCADOPAGO_ACCESS_TOKEN=
```

---

### Stripe (activo)

**Rol:** proveedor internacional card payments
**Usado en:** `pasarelapagos-backend`
**Variables:**
```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_WEBHOOK_SECRET_PREVIOUS=   # rotación de secrets
```

---

### dLocal (activo)

**Rol:** pagos fuera de LATAM core
**Variables:**
```bash
DLOCAL_API_KEY=
DLOCAL_API_SECRET=
```

---

### Conekta (activo)

**Rol:** México
**Variables:**
```bash
CONEKTA_API_KEY=
```

---

### PagarMe (activo)

**Rol:** Brasil
**Variables:**
```bash
PAGARME_API_KEY=
```

---

### Fake (activo)

**Rol:** testing y desarrollo — nunca en producción
**Variables:** ninguna

> ⚠️ Verificar que el proveedor Fake no pueda activarse en `NODE_ENV=production`.

**Resiliencia general de pagos:**
- Circuit breaker por proveedor: ✅ implementado
- Idempotencia: ✅ `idempotencyKey` obligatorio en cada intent
- Reconciliación: ✅ job automático en `pasarelapagos-backend`
- Webhook signing: ✅ `WEBHOOK_SIGNING_SECRET` con tolerancia configurable
- PII encryption: ✅ `PII_ENCRYPTION_KEY` para datos sensibles

---

## Canales de mensajería

### WhatsApp Business API (activo)

**Usado en:** `chatia-backend` · `notificaciones-backend`
**Variables:**
```bash
# chatia-backend
WHATSAPP_VERIFY_TOKEN=

# notificaciones-backend
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

---

### Instagram / Facebook Messenger (activo)

**Usado en:** `chatia-backend`
**Auth:** tokens de Meta configurados por organización en DB (no en env)

---

### TikTok (activo)

**Usado en:** `chatia-backend` · `marketing-backend`
**Variables:**
```bash
# marketing-backend
TIKTOK_APP_ID=
TIKTOK_APP_SECRET=
TIKTOK_ACCESS_TOKEN=
```

---

## Email

### SendGrid (activo)

**Rol:** envío de emails transaccionales
**Usado en:** `notificaciones-backend`
**Variables:**
```bash
SENDGRID_API_KEY=
```

**Resiliencia:**
- Queue: emails van por BullMQ — retry con backoff si SendGrid falla
- DLQ: jobs fallidos van a DLQ con retry manual via `dlq.controller.ts`
- Fallback: 🔲 sin fallback si SendGrid cae permanentemente

---

## Marketing

### Meta Ads (activo)

**Variables:**
```bash
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
```

### Google Ads (activo)

**Variables:**
```bash
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_REFRESH_TOKEN=
```

---

## Regla general de resiliencia

Antes de pasar cualquier proveedor a producción económica (Hetzner):
1. Timeout configurado explícitamente
2. Retry con backoff exponencial
3. Circuit breaker o degradación elegante documentada
4. Variable de entorno en el `.env.example` del servicio
5. DLQ configurado para jobs async

