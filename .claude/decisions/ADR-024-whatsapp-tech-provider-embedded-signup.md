# ADR-024 — WhatsApp multi-organización: una app de plataforma (Tech Provider) + Embedded Signup

**Fecha:** 2026-10-20 · **Estado:** Aceptado como **norte** — la parte de Meta y la pantalla del dashboard **no están construidas**; lo ya funcionando se detalla en "Estado real"

## Contexto
Cada organización (`organizationId`, dentro de un `ecosystemId`) debe conectar **su propio** número de WhatsApp y **hacerse cargo
de sus cuentas y de sus gastos**; la plataforma no debe pagar ni custodiar medios de pago de los clientes.

El 2026-10-20 se probó el circuito completo en local (ngrok → chatia → cola → Groq → respuesta por la Graph API) con la app
Meta "welver" y el número de prueba. Esa prueba fue un **atajo**: una org de humo (`smoke-org`) creada por script y las credenciales
de una sola persona. No es el flujo de producción.

## Decisión
1. **Una sola app de Meta para toda la plataforma** (hoy "welver"), registrada como **Tech Provider**. Un solo `META_APP_SECRET`,
   un solo webhook (`/api/v1/webhooks/whatsapp/{phoneNumberId}`); chatia ya resuelve la organización por `phoneNumberId`.
2. **Cada organización conecta su WhatsApp con Embedded Signup** desde el dashboard ("Conectar WhatsApp"). En ese flujo el cliente:
   inicia sesión con su Facebook, elige o crea **su** Business y **su** WABA, registra su número y carga **su** forma de pago.
   La WABA y el número son del cliente; Meta le factura a él.
3. **Backend:** un endpoint autenticado (`TenantGuard`: Firebase + `x-organization-id`) recibe el `code` de Embedded Signup, lo
   canjea por el token del cliente, crea el `ChannelAccount` de **esa** organización (token cifrado con `TokenCipher`) y
   **suscribe la WABA a la app** (`POST /{waba-id}/subscribed_apps`), el mismo paso que se hizo a mano en la prueba.
4. **Nunca** pedir a cada organización que cree su propia app de Meta.

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| Cada organización crea su propia app de Meta | Exige App Review y verificación por cliente, conocimientos técnicos y soporte nuestro; un `appSecret` distinto por org (`extraConfig.appSecret` lo soporta pero multiplica el riesgo); onboarding de semanas |
| Solution Partner con línea de crédito (nosotros pagamos y revendemos) | Asumimos el costo y el riesgo de impago; va contra el principio de que cada cliente se hace cargo de su gasto |
| Cargar a mano Phone ID + token por cliente (lo que se hizo en la prueba) | No escala, el token queda en manos de un operador, y los tokens temporales vencen en 24 h |

## Estado real (verificado el 2026-10-20)
**Funciona y está probado en local** (con el token temporal de Meta):
- Verificación del webhook (`GET`) y recepción firmada (`POST`) con `META_APP_SECRET`.
- Cola `incoming-message` → conversación → IA → cola `outgoing-message` → `WhatsAppChannel.sendMessage`.
- Cuentas por organización: `ChannelAccount` con token cifrado, `POST /api/v1/channel-accounts` bajo `TenantGuard`.

**Implementado en chatia-backend (2026-10-20), con tests unitarios y sin probar contra Meta real:**
- `POST /api/v1/channel-accounts/whatsapp/embedded-signup` (`{code, wabaId, phoneNumberId, name?}`): solo OWNER/ADMIN; canjea el
  código, comprueba contra Meta que el número pertenece a la WABA, rechaza (409) un número ya conectado a otra organización,
  suscribe la WABA a la app y la **verifica**, registra el número (si falla no bloquea: devuelve `registered:false`) y crea o
  actualiza el `ChannelAccount` con el token cifrado. Reconectar el mismo número de la misma org actualiza el token.
- `GET /api/v1/channel-accounts/whatsapp/:id/status`: token vigente y WABA suscrita (solo cuentas de la organización).
- Puerto `core/channel-accounts/whatsapp-graph.port.ts` + `WhatsAppGraphClient` (infrastructure) enlazado por `WhatsAppAdminModule`.
- Variables nuevas: `META_APP_ID`, `META_GRAPH_VERSION` (default `v23.0`; antes estaba fija en `v19.0`).
- Normalización de números por tabla (`phone-normalization.ts`): Argentina `549…→54…` y México `521…→52…`.

**Sin verificar contra Meta real** (hacerlo con la app publicada): el registro del número usa un PIN aleatorio que no se guarda
(si el número ya tenía verificación en dos pasos habrá que pedir el PIN al cliente), y el canje del código con `GET /oauth/access_token`.

**No existe todavía:**
- Pantalla "Conectar WhatsApp" en `realsass-dashboard-front` (no hay ningún uso de `channel-accounts` en `ecosistema`).
- La cuenta creada por Embedded Signup no trae proyecto ni configuración de IA: falta el paso que la asocia a un proyecto/asistente.
- App de Meta publicada, negocio verificado, acceso avanzado a `whatsapp_business_management` / `whatsapp_business_messaging`
  y alta como Tech Provider.
- Token permanente: hoy se usa el temporal de 24 h.
- Plantillas de mensaje (necesarias para escribir fuera de la ventana de 24 h): `sendMessage` solo envía texto e imagen.

## Consecuencias

**Ganancia:** onboarding de un clic para el cliente, gasto y titularidad de la cuenta en el cliente, un solo secreto y un solo
webhook para operar.

**Riesgos conscientes:**
- La app es compartida: el abuso de un cliente (spam) puede sancionar la app y afectar a todos. Hacen falta términos de uso y
  monitoreo de calidad por número.
- Dependencia de Meta: si suspende la app, caen todos los clientes.
- Las reglas de facturación y los requisitos de Tech Provider / Embedded Signup **cambian**: confirmarlos en la documentación
  vigente de Meta antes de comprometer plazos o precios con clientes.

## Deuda detectada en la prueba (a cerrar antes de producción)
1. ~~Normalización solo Argentina~~ → ahora tabla por país (AR y MX). Se descartó `libphonenumber-js`: las excepciones las
   define Meta y la librería no las conoce. Otros países (p. ej. Brasil) se agregan con una fila + test cuando se confirme el caso real.
2. ~~Versión fija `v19.0`~~ → `META_GRAPH_VERSION` (default `v23.0`). Instagram/Messenger siguen en `v19.0` (no se tocaron).
3. **Plantillas de mensaje** (ver arriba) y soporte de más tipos salientes: pendiente.
4. **`chatia-backend/SETUP.md` desactualizado**: documenta `/whatsapp-accounts` y `/webhooks/meta/...`; las rutas reales son
   `/channel-accounts` y `/webhooks/whatsapp/...`.
5. **Un `curl` de diagnóstico no basta**: la causa de "no llega nada" fue que la WABA estaba suscrita solo a la app interna de Meta y
   no a la app propia. Embedded Signup debe verificar `GET /{waba-id}/subscribed_apps` tras el alta.

## Referencias
- `chatia-backend/src/modules/common/webhooks/webhooks.controller.ts`, `chatia-backend/src/core/webhooks/webhooks.service.ts`
- `chatia-backend/src/modules/common/channel-accounts/channel-accounts.controller.ts`
- `chatia-backend/src/infrastructure/channels/whatsapp/whatsapp.channel.ts`
- `chatia-backend/src/infrastructure/common/guards/tenant.guard.ts`
- `.claude/modules/chatia-backend/channels.md`
- Dashboard: `realsass-dashboard-front` (`features/chat`, `lib/chat-ia-client.ts`)

## Actualización 2026-10-20 — lo construido (compila y con tests; **sin probar contra Meta**)
- **Alta, estado y baja** en chatia-backend: `WhatsAppOnboardingService.connect/status/current/disconnect`. La baja quita la suscripción de la WABA
  (mejor esfuerzo), desactiva la cuenta y descarta el token; los webhooks de una cuenta inactiva se rechazan.
- **Endpoints internos** (servicio-a-servicio, `InternalApiKeyGuard`) que consume sass-back: `GET|POST|DELETE /internal/whatsapp/:organizationId…`.
  Aseguran la organización en el ecosistema (`FIREBASE_PROJECT_ID`) antes de crear la cuenta.
- **Webhook único de plataforma** `GET|POST /api/v1/webhooks/whatsapp`: la app de Meta tiene UNA url de callback para todos los clientes, así que
  la ruta con id de número no alcanza. Firma con `META_APP_SECRET`, verify token `META_WEBHOOK_VERIFY_TOKEN`, enrutado por `metadata.phone_number_id`.
- **Graph API**: versión por `META_GRAPH_VERSION` (default v23.0); normalización de números tabulada (Argentina y México).
- Lado ecosistema (pantalla, sass-back y contrato): `ecosistema/.claude/decisions/ADR-025-whatsapp-embedded-signup-sass-front.md`.
- **Sigue pendiente:** app de Meta (Tech Provider, `config_id`), plantillas de mensaje, más países en la normalización, prueba con número real.
