# Meta (WhatsApp) — pilar de dominio

> Fuente de verdad de **cómo se conecta Meta a la plataforma** y qué hay que cumplir para que funcione a escala.
> Decisión: `decisions/ADR-024-whatsapp-tech-provider-embedded-signup.md`. Si este archivo y el código se contradicen, gana este archivo.
> Última verificación contra Meta real: **2026-10-20, solo con el número de prueba** (ver "Estado").

## 1. Principio de negocio
- **Una sola app de Meta** para toda la plataforma (hoy "welver", id `3436003559905169`), registrada como **Tech Provider**.
- **Cada organización conecta SU WhatsApp** con Embedded Signup: la WABA, el número y la **forma de pago son del cliente**; Meta le
  factura a él. La plataforma no paga ni custodia medios de pago de clientes.
- **Nunca** pedir a una organización que cree su propia app de Meta.
- Quién autoriza dentro de la plataforma: el usuario autenticado con **Firebase** y con rol OWNER/ADMIN. Firebase **no interviene**
  en el popup de Embedded Signup (ese login es la cuenta de Facebook del cliente, otra identidad).

## 2. Flujo extremo a extremo
```
Dashboard (Firebase) ──tRPC──▶ sass-back (valida OWNER + step-up) ──HTTP + clave interna──▶ chatia-backend
   │                                                                                          │
   │ FB.login(config_id) → popup Embedded Signup → code + waba_id + phone_number_id           │
   └──────────────────────────────────────────────────────────────────────────────────────────┘
chatia: canjea code → verifica que el número es de esa WABA → 409 si es de otra org → suscribe la WABA a la app
        y VERIFICA la suscripción → registra el número → guarda ChannelAccount (token cifrado)

Mensajes:  cliente final ─WhatsApp─▶ Meta ─POST firmado─▶ /api/v1/webhooks/whatsapp (UNA URL para toda la app)
           chatia valida la firma UNA vez (META_APP_SECRET), enruta por metadata.phone_number_id → cola → IA → Graph API (envío)
```
- Meta registra **una sola URL de callback por app**. El número se identifica por `metadata.phone_number_id` del payload.
- La ruta por número (`/api/v1/webhooks/whatsapp/{phoneNumberId}`) sigue existiendo (cuentas cargadas a mano / pruebas).

## 3. Mapa del código (chatia-backend)
| Pieza | Archivo |
|---|---|
| Webhook único + verificación | `modules/common/webhooks/webhooks.controller.ts`, `core/webhooks/webhooks.service.ts` (`verifyPlatform`, `handlePlatformEvent`) |
| Alta/estado/baja (usuario, Firebase) | `modules/common/channel-accounts/whatsapp-onboarding.controller.ts` |
| Alta/estado/baja (servicio a servicio) | `modules/common/channel-accounts/whatsapp-internal.controller.ts` (`/internal/whatsapp/:organizationId`, clave interna) |
| Lógica del alta | `core/channel-accounts/whatsapp-onboarding.service.ts` |
| Puerto hacia Meta | `core/channel-accounts/whatsapp-graph.port.ts` |
| Cliente Graph (administración) | `infrastructure/channels/whatsapp/whatsapp-graph.client.ts` (+ `whatsapp-admin.module.ts`) |
| Envío / parseo de mensajes | `infrastructure/channels/whatsapp/whatsapp.channel.ts` |
| Versión de Graph API | `infrastructure/channels/whatsapp/graph-api.ts` (`META_GRAPH_VERSION`, default `v23.0`) |
| Formato de números al enviar | `infrastructure/channels/whatsapp/phone-normalization.ts` (tabla por país: AR, MX) |

## 4. Variables de entorno
| Variable | Para qué | Dónde se obtiene |
|---|---|---|
| `META_APP_ID` | Identifica la app de la plataforma (canje del código, verificar suscripción) | Meta → Configuración de la app → Básica |
| `META_APP_SECRET` | Firma HMAC de webhooks + canje del código. **Obligatoria en producción** | Misma pantalla (Mostrar) |
| `META_WEBHOOK_VERIFY_TOKEN` | Token que Meta envía al verificar el webhook único. Lo inventamos nosotros (`openssl rand -hex 24`) | Se pega igual en el panel de Meta |
| `META_GRAPH_VERSION` | Versión de la Graph API (formato `v23.0`) | Opcional |
| `CHANNEL_TOKEN_ENCRYPTION_KEY` | Cifra los tokens de cada cliente en la base. **Obligatoria en producción** | `openssl rand -base64 32` |
| `APP_URL` | URL pública del servicio (la que ve Meta) | ngrok en local, Railway en producción |

Los tokens de los clientes **nunca** se guardan en claro, nunca salen en una respuesta (`toPublicAccount`) y nunca se loguean.

## 5. Checklist para producción
Estados: ✅ hecho y probado · 🟡 hecho en código, sin probar contra Meta real · 🔲 pendiente (tarea humana en Meta o producto).

**Código**
- ✅ Webhook firmado → cola → IA → respuesta (probado con número de prueba, 2026-10-20).
- 🟡 Alta por Embedded Signup (canje de código, validación de pertenencia, 409 entre organizaciones, suscripción verificada, registro, baja).
- 🟡 Webhook único de plataforma (verificado por el túnel; falta probarlo con eventos reales de Meta).
- ✅ Formato de números AR/MX al enviar (error `#131030` resuelto en AR).
- 🔲 Plantillas de mensaje (necesarias para escribir fuera de la ventana de 24 h) y envío de más tipos (hoy: texto e imagen).
- 🔲 Asociar la cuenta recién conectada a un asistente: sin asistente configurado en la organización la IA no responde (`not_configured`).

**Meta (en este orden; los dos primeros tardan días, empezar ya)**
1. 🔲 **Verificación del negocio**: Business Settings → Centro de seguridad → Iniciar verificación.
2. 🔲 **Configuración básica de la app**: política de privacidad, condiciones, eliminación de datos, categoría, ícono, dominios (dashboard).
3. 🔲 **Embedded Signup**: Inicio de sesión con Facebook para empresas → Configuraciones → plantilla de WhatsApp Embedded Signup →
   obtener el `config_id`; agregar el dominio del dashboard al SDK de JavaScript.
4. 🔲 **Probar de punta a punta en modo desarrollo** (funciona solo para quienes tienen rol en la app): dashboard → popup → alta → mensaje real.
5. 🔲 **Tech Provider + App Review**: acceso avanzado a `whatsapp_business_management` y `whatsapp_business_messaging` (pide grabación
   del flujo, descripción del caso de uso y credenciales de prueba) y publicar la app (modo Live).
6. 🔲 **Webhook de producción**: en la app de Meta, URL de callback `https://<dominio>/api/v1/webhooks/whatsapp` y `META_WEBHOOK_VERIFY_TOKEN`;
   suscribir el campo `messages`.
7. 🔲 Cargar las variables de la sección 4 en Railway.

> Las reglas de Tech Provider, Embedded Signup y facturación **cambian**: confirmar cada requisito en la documentación vigente de Meta
> antes de comprometer plazos o precios con clientes.

## 6. Pruebas en local (ngrok)
1. `ngrok http 3010` y poner la URL en `APP_URL`; chatia con `REDIS_ENABLED=true`.
2. Meta → WhatsApp → Configuración → Webhook: callback `https://<ngrok>/api/v1/webhooks/whatsapp` + `META_WEBHOOK_VERIFY_TOKEN`; campo `messages`.
3. Escribirle al número de prueba **desde un número agregado en "Para"**. En `http://127.0.0.1:4040` debe aparecer un `POST` con 200.
4. El token temporal de Meta **vence a las 24 h** (error 190): regenerarlo. Nunca pegarlo en un chat ni en un commit.

## 7. Diagnóstico (lo aprendido en la primera prueba)
| Síntoma | Causa y arreglo |
|---|---|
| El `GET` de verificación llega pero nunca llega un `POST` | La **WABA no está suscrita a la app**. `GET /{waba-id}/subscribed_apps` debe listar nuestra app; si no, `POST` al mismo endpoint (el alta lo hace y lo verifica). También: app en modo desarrollo y el remitente no es un número de prueba |
| `POST` con 200 pero no hay respuesta | Mirar los trabajos fallidos de la cola `outgoing-message` (`dlqDepth` en `/health`); el motivo está en `failedReason` |
| `(#131030) Recipient phone number not in allowed list` | Formato del número. Argentina llega como `549…` y hay que enviar `54…`; México `521…` → `52…`. O el destinatario no está en la lista "Para" del número de prueba |
| `(#190) Session has expired` | Token vencido. Reconectar (cliente) o regenerar (prueba) |
| `POST` con 401 | Firma inválida: `META_APP_SECRET` distinto al de la app |
| `409` al conectar | Ese número ya está conectado a otra organización |
| Se ve "Preguntar a la IA" / pantallas distintas en el panel de Meta | El panel de Meta cambia con frecuencia; los nombres de este documento pueden diferir |

## 8. Riesgos y reglas
- La app es **compartida**: el abuso de un cliente (spam) puede sancionar la app y afectar a todos. Términos de uso claros y monitoreo de
  calidad por número.
- Dependencia de Meta: si suspende la app, caen todos los clientes.
- Un número solo puede estar conectado a **una** organización (clave única `channelType + externalId`).
- La identidad (organización, rol) sale siempre del token/clave interna, **nunca del body**.
- No se rechaza el lote entero ante un número desconocido o desconectado (Meta reintenta los lotes que devuelven error): se ignora y se loguea.
