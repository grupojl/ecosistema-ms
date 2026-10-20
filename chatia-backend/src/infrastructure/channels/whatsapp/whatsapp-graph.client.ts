// src/infrastructure/channels/whatsapp/whatsapp-graph.client.ts
// Llamadas de ADMINISTRACIÓN a la Graph API de Meta (Embedded Signup): canje de código, suscripción de la WABA,
// registro del número y estado. El envío de mensajes vive en WhatsAppChannel.
// Los errores nunca incluyen el token ni la URL (llevan secretos en la query).
import { Injectable } from '@nestjs/common';
import { graphBaseUrl } from '@/infrastructure/channels/whatsapp/graph-api.js';
import {
  GraphApiError,
  type IWhatsAppGraph,
  type WhatsAppPhoneInfo,
} from '@/core/channel-accounts/whatsapp-graph.port.js';

const TIMEOUT_MS = 10_000;

interface GraphErrorBody {
  error?: { message?: string; code?: number };
}

@Injectable()
export class WhatsAppGraphClient implements IWhatsAppGraph {
  /** App de la plataforma (Tech Provider). Sin ambos valores no se puede canjear el código de Embedded Signup. */
  appCredentials(): { appId: string; appSecret: string } | null {
    const appId = process.env['META_APP_ID'];
    const appSecret = process.env['META_APP_SECRET'];
    return appId && appSecret ? { appId, appSecret } : null;
  }

  async exchangeCode(code: string): Promise<string> {
    const creds = this.appCredentials();
    if (!creds)
      throw new GraphApiError(0, undefined, 'App de Meta sin configurar');
    const query = new URLSearchParams({
      client_id: creds.appId,
      client_secret: creds.appSecret,
      code,
    });
    const data = await this.call<{ access_token?: string }>(
      `/oauth/access_token?${query.toString()}`,
    );
    if (!data.access_token)
      throw new GraphApiError(502, undefined, 'Meta no devolvió access_token');
    return data.access_token;
  }

  async listPhoneNumbers(
    wabaId: string,
    token: string,
  ): Promise<WhatsAppPhoneInfo[]> {
    const data = await this.call<{
      data?: Array<{
        id: string;
        display_phone_number?: string;
        verified_name?: string;
        status?: string;
      }>;
    }>(
      `/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name,status`,
      { token },
    );
    return (data.data ?? []).map((p) => ({
      id: p.id,
      displayPhoneNumber: p.display_phone_number ?? '',
      verifiedName: p.verified_name ?? '',
      status: p.status ?? 'UNKNOWN',
    }));
  }

  async subscribeApp(wabaId: string, token: string): Promise<void> {
    await this.call(`/${encodeURIComponent(wabaId)}/subscribed_apps`, {
      token,
      method: 'POST',
    });
  }

  /** Ids de las apps de Meta suscritas a la WABA. */
  async listSubscribedAppIds(wabaId: string, token: string): Promise<string[]> {
    const data = await this.call<{
      data?: Array<{ whatsapp_business_api_data?: { id?: string } }>;
    }>(`/${encodeURIComponent(wabaId)}/subscribed_apps`, { token });
    return (data.data ?? [])
      .map((a) => a.whatsapp_business_api_data?.id)
      .filter((id): id is string => typeof id === 'string');
  }

  async unsubscribeApp(wabaId: string, token: string): Promise<void> {
    await this.call(`/${encodeURIComponent(wabaId)}/subscribed_apps`, {
      token,
      method: 'DELETE',
    });
  }

  async registerPhone(
    phoneNumberId: string,
    token: string,
    pin: string,
  ): Promise<void> {
    await this.call(`/${encodeURIComponent(phoneNumberId)}/register`, {
      token,
      method: 'POST',
      body: { messaging_product: 'whatsapp', pin },
    });
  }

  private async call<T = unknown>(
    path: string,
    opts: {
      token?: string;
      method?: 'GET' | 'POST' | 'DELETE';
      body?: unknown;
    } = {},
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${graphBaseUrl()}${path}`, {
        method: opts.method ?? 'GET',
        headers: {
          ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
          ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new GraphApiError(0, undefined, 'No se pudo contactar a Meta');
    }
    const body = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
    if (!res.ok) {
      throw new GraphApiError(
        res.status,
        body.error?.code,
        body.error?.message ?? `Meta respondió ${res.status}`,
      );
    }
    return body;
  }
}
