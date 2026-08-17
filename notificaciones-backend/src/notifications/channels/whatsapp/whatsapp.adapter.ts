// notificaciones-backend/src/notifications/channels/whatsapp/whatsapp.adapter.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService }                    from '@nestjs/config';
import type { INotificationChannel, SendPayload } from '../../interfaces/notification-channel.interface.js';

const META_API_VERSION = 'v21.0';

@Injectable()
export class WhatsappAdapter implements INotificationChannel, OnModuleInit {
  private readonly logger = new Logger(WhatsappAdapter.name);
  private metaToken       = '';
  private phoneNumberId   = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.metaToken     = this.config.get<string>('META_SYSTEM_TOKEN')    ?? '';
    this.phoneNumberId = this.config.get<string>('META_PHONE_NUMBER_ID') ?? '';
    if (!this.metaToken || !this.phoneNumberId) {
      this.logger.warn('META_SYSTEM_TOKEN o META_PHONE_NUMBER_ID no configurados — WhatsApp deshabilitado');
    }
  }

  get channel(): 'WHATSAPP' { return 'WHATSAPP'; }
  isConfigured(): boolean   { return !!(this.metaToken && this.phoneNumberId); }

  async send(payload: SendPayload): Promise<void> {
    if (!this.isConfigured()) throw new Error('WhatsApp no configurado');

    const url = `https://graph.facebook.com/${META_API_VERSION}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.metaToken}` },
      body:    JSON.stringify(this.buildBody(payload)),
    });

    if (!res.ok) throw new Error(`Meta API error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { messages?: Array<{ id: string }> };
    this.logger.debug(`WhatsApp enviado a ${payload.to} — msgId: ${data.messages?.[0]?.id}`);
  }

  private buildBody(payload: SendPayload): Record<string, unknown> {
    if (payload.templateKey) {
      return {
        messaging_product: 'whatsapp', to: payload.to, type: 'template',
        template: {
          name: payload.templateKey,
          language: { code: payload.language ?? 'es_AR' },
          components: payload.templateVariables?.length
            ? [{ type: 'body', parameters: payload.templateVariables.map(v => ({ type: 'text', text: v })) }]
            : [],
        },
      };
    }
    return { messaging_product: 'whatsapp', to: payload.to, type: 'text', text: { body: payload.body, preview_url: false } };
  }
}
