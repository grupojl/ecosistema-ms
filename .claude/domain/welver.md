# Welver — Dominio y comportamiento esperado

> Última actualización: 2026-10-02
> Referencia de código: `chatia-backend/src/modules/welver/`

---

## Qué es Welver

Plataforma de ecommerce para tiendas online en LATAM.
El chat IA atiende a compradores que tienen dudas sobre productos,
precios, disponibilidad y proceso de compra.

---

## El usuario final (contacto)

**Quién es:** comprador online, mayoría mobile, canales WhatsApp e Instagram.
Espera respuesta en menos de 30 segundos. No tolera respuestas genéricas.

**Qué busca:**
- Información de producto específica (precio, talla, disponibilidad)
- Estado de su pedido
- Resolver un problema post-compra (cambio, devolución)
- A veces solo quiere hablar con una persona

**Tono esperado del bot:**
- Directo y concreto — no florido
- Usa el nombre del contacto si está disponible
- No promete lo que no puede cumplir
- Si no sabe algo, lo dice y escala a humano

**Lo que NO debe experimentar:**
- Respuestas de más de 3 párrafos para una pregunta simple
- Loops de "no entendí tu mensaje" más de 2 veces seguidas
- Que el bot responda después de que un agente humano tomó la conversación
- Recibir notificaciones si optó out

---

## La organización (tenant)

**Quién es:** dueño o equipo de una tienda online — no necesariamente técnico.
Accede al dashboard para ver conversaciones, asignar agentes y revisar métricas.

**Qué espera:**
- Ver en tiempo real qué está pasando en sus chats
- Saber cuántas conversaciones están abiertas, escaladas, resueltas
- Poder tomar control de una conversación cuando el bot no puede resolverla
- Recibir alertas cuando hay algo urgente (ROAS bajo, escalaciones acumuladas)

**Métricas que le importan:**
- Tasa de resolución automática (bot resolvió sin escalar)
- Tiempo promedio de respuesta
- Conversaciones escaladas por período
- Satisfacción implícita (conversación cerrada sin queja)

---

## Flujo de conversación esperado

```
CONTACTO ESCRIBE
       ↓
  [INITIAL] ←─────────────────────────────────────────────┐
       ↓                                                    │
  Clasificar intent (LLM)                                   │
       ↓                                                    │
  ┌────┴────┐                                               │
  │         │                                               │
[FAQ]   [CONVERSANDO]                                       │
  │         │                                               │
  │    ┌────┴────────────────┐                              │
  │    │                     │                              │
  │  [CALIFICANDO]     intent=farewell                      │
  │    │                     ↓                              │
  │    │              [RESUELTO] ──── inactividad 30min ────┘
  │    │
  │  [PROPUESTA]
  │    │
  │  [NEGOCIANDO]
  │    │
  │  [CIERRE]
  │    │
  └──→[RESUELTO]
       ↑
  [ESCALADO] → agente humano toma control
       │
       └── agente marca resuelto → [RESUELTO]
```

**Transiciones válidas:**
- `INITIAL` → cualquier estado
- `CALIFICANDO` → `PROPUESTA` | `ESCALADO` | `RESUELTO`
- `PROPUESTA` → `NEGOCIANDO` | `CIERRE` | `ESCALADO`
- `NEGOCIANDO` → `CIERRE` | `ESCALADO`
- `CIERRE` → `RESUELTO`
- `ESCALADO` → `RESUELTO` (solo el agente humano puede cerrar)
- `RESUELTO` → `INITIAL` (si el contacto vuelve a escribir)

**Cuándo escalar a humano (obligatorio):**
- intent = `human_request` explícito
- Confianza del LLM < umbral configurado 2 veces seguidas
- Conversación sin respuesta del bot por más de 5 minutos (falla técnica)
- El contacto expresa frustración explícita ("quiero hablar con una persona")

**Cuándo cerrar automáticamente:**
- intent = `farewell` confirmado por el LLM
- Inactividad del contacto > 30 minutos en estado RESUELTO
- El agente marca la conversación como resuelta desde el dashboard

---

## Reglas de negocio específicas de Welver

### Bot
- Usa el modelo configurado en `AssistantConfig.groqModel` por organización
  (default: `llama-3.3-70b-versatile`)
- Si hay Knowledge Base activa → usa FAQ fallback antes de responder con LLM
- Si el CB de Groq está abierto → responde con `AssistantConfig.fallbackMessage`
  y escala a humano. NUNCA responde con string hardcodeado.
- Máximo de mensajes por conversación: configurable por plan
  (`ChatLimits.maxMessagesPerConversation`)
- Inactividad que cierra conversación: configurable
  (`ChatLimits.inactivityTimeoutSeconds`, default 1800s)

### Canales habilitados
- WhatsApp Business API ✅
- Instagram Messenger ✅
- Facebook Messenger ✅
- TikTok ✅ (según config de la org)
- Widget web ✅

### Pagos
- Proveedores según país del contacto
- LATAM default: MercadoPago
- Card + Stripe si `featureFlags.stripeEnabled`
- dLocal si `featureFlags.dlocalEnabled` y país fuera de LATAM core

### Notificaciones al agente
- Nueva conversación → push + in-app
- Escalación → push + in-app + (opcional) email
- Sin respuesta de agente en X minutos → escalation alert

### Multi-canal
- Un contacto puede tener conversaciones abiertas en distintos canales
- Son conversaciones independientes — no se mezclan
- El historial es por `(organizationId, channelType, externalId)`

---

## Lo que NO debe pasar (invariantes)

Estos casos son bugs de producto, no de código. Si ocurren hay que investigar.

| Caso | Por qué es un bug |
|------|-------------------|
| Bot responde después de que un agente tomó la conversación | `isAiActive` debe ser `false` cuando un agente interviene |
| Se cobra dos veces el mismo pago | `idempotencyKey` obligatorio en cada intent de pago |
| Notificación enviada a contacto con `optedOut: true` | El processor debe verificar preferencias antes de enviar |
| Conversación sin `organizationId` en la query | Multi-tenancy roto — data leak potencial |
| El bot responde en idioma distinto al del contacto | El system prompt debe detectar idioma del primer mensaje |
| Escalación sin notificación al agente | El evento de escalación siempre dispara notificación |

---

## KPIs que indican que el sistema funciona bien para Welver

| KPI | Objetivo | Cómo se mide |
|-----|----------|-------------|
| Tasa de resolución automática | > 70% | `conversation.resolved` sin `assignedAgentId` |
| Tiempo de primera respuesta del bot | < 5s | `message.createdAt` - `conversation.createdAt` |
| Tasa de escalación | < 30% | `ESCALADO` / total conversaciones |
| Inactividad no resuelta | < 5% | Conversaciones cerradas por timeout sin resolución explícita |
| Uptime del bot | > 99.5% | CB de Groq cerrado / tiempo total |

---

## Notas de implementación para el equipo

- `WelverStrategy.enrichConversationContext()` nunca lanza — siempre fallback
- `buildWelverSystemPrompt()` en `welver.config.ts` es el único lugar donde
  se construye el system prompt. No hardcodear prompts en el service.
- `resolveBusinessData()` lee de Prisma directo — candidato a mover a
  `IOrganizationConfigRepository` en la próxima iteración (Pilar 2)
- Los stages de conversación son strings en DB (`ConversationStage` enum en Prisma)
  — cualquier stage nuevo requiere migración de schema

