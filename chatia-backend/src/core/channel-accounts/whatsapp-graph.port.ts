// src/core/channel-accounts/whatsapp-graph.port.ts
// Puerto hacia la Graph API de Meta para el alta de WhatsApp (Embedded Signup). core/ depende de esta interfaz;
// la implementación HTTP vive en infrastructure/channels/whatsapp (misma idea que los repositorios).
export const WHATSAPP_GRAPH = Symbol('WHATSAPP_GRAPH');

export class GraphApiError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly graphCode: number | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'GraphApiError';
  }
}

export interface WhatsAppPhoneInfo {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  status: string;
}

export interface IWhatsAppGraph {
  /** App de la plataforma (Tech Provider); null si falta META_APP_ID o META_APP_SECRET. */
  appCredentials(): { appId: string; appSecret: string } | null;
  exchangeCode(code: string): Promise<string>;
  listPhoneNumbers(wabaId: string, token: string): Promise<WhatsAppPhoneInfo[]>;
  subscribeApp(wabaId: string, token: string): Promise<void>;
  /** Ids de las apps de Meta suscritas a la WABA. */
  listSubscribedAppIds(wabaId: string, token: string): Promise<string[]>;
  /** Quita la suscripción de la app a la WABA (deja de recibir webhooks de ese cliente). */
  unsubscribeApp(wabaId: string, token: string): Promise<void>;
  registerPhone(
    phoneNumberId: string,
    token: string,
    pin: string,
  ): Promise<void>;
}
