// notificaciones-backend/src/notifications/channels/email/email.adapter.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService }                    from '@nestjs/config';
import type { INotificationChannel, SendPayload } from '../../interfaces/notification-channel.interface.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

@Injectable()
export class EmailAdapter implements INotificationChannel, OnModuleInit {
  private readonly logger = new Logger(EmailAdapter.name);
  private apiKey      = '';
  private fromAddress = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.apiKey      = this.config.get<string>('RESEND_API_KEY')      ?? '';
    this.fromAddress = this.config.get<string>('RESEND_FROM_ADDRESS') ?? '';
    if (!this.apiKey || !this.fromAddress) {
      this.logger.warn('RESEND_API_KEY o RESEND_FROM_ADDRESS no configurados — Email deshabilitado');
    }
  }

  get channel(): 'EMAIL' { return 'EMAIL'; }
  isConfigured(): boolean { return !!(this.apiKey && this.fromAddress); }

  async send(payload: SendPayload): Promise<void> {
    if (!this.isConfigured()) throw new Error('Email no configurado');

    const html = this.renderHtml(payload);
    const res  = await fetch(RESEND_API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        from:    this.fromAddress,
        to:      [payload.to],
        subject: payload.subject ?? this.subjectFromTemplate(payload.templateKey),
        html,
        text:    html.replace(/<[^>]+>/g, '').trim(),
        tags:    [{ name: 'template', value: payload.templateKey ?? 'custom' }],
      }),
    });

    const data = await res.json() as { id: string; error?: { message: string } };
    if (!res.ok || data.error) throw new Error(`Resend error: ${data.error?.message ?? res.status}`);
    this.logger.debug(`Email enviado a ${payload.to} — resendId: ${data.id}`);
  }

  private renderHtml(p: SendPayload): string {
    let body = p.body;
    p.templateVariables?.forEach((v, i) => { body = body.replace(new RegExp(`\\{\\{${i+1}\\}\\}`, 'g'), v); });
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>body{font-family:-apple-system,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px}.content{background:#f9f9f9;padding:24px;border-radius:8px}</style></head><body><div class="content"><p>${body.replace(/\n/g,'<br>')}</p></div></body></html>`;
  }

  private subjectFromTemplate(k?: string): string {
    return ({ 'conversation.new':'Nueva conversación','message.new':'Nuevo mensaje','escalation.alert':'Escalación requerida' } as Record<string,string>)[k ?? ''] ?? 'Notificación';
  }
}
