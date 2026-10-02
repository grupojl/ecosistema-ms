// notificaciones-backend/src/core/notifications/interfaces/channel-tokens.ts
// Tokens NestJS para inyección de dependencias.
// El core inyecta estas abstracciones — nunca importa los adapters directamente.
// La dirección de dependencia es siempre: infrastructure → core

export const NS_EMAIL_CHANNEL_TOKEN     = Symbol("NS_EMAIL_CHANNEL_TOKEN");
export const NS_PUSH_CHANNEL_TOKEN      = Symbol("NS_PUSH_CHANNEL_TOKEN");
export const NS_WHATSAPP_CHANNEL_TOKEN  = Symbol("NS_WHATSAPP_CHANNEL_TOKEN");
export const NS_TEMPLATE_RENDERER_TOKEN = Symbol("NS_TEMPLATE_RENDERER_TOKEN");
