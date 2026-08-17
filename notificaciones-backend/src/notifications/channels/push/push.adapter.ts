// notificaciones-backend/src/notifications/channels/push/push.adapter.ts
//
// Push via Firebase Cloud Messaging (FCM).
// Usa Firebase Admin SDK — el mismo que usa auth, así que ya está en el catalog.
// Soporte: data payload + notification payload, batch hasta 500 tokens.
// Limpieza automática de tokens inválidos (FCM retorna UNREGISTERED).

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService }                    from '@nestjs/config';
import type { App }                         from 'firebase-admin/app';
import type { Message, MulticastMessage }   from 'firebase-admin/messaging';
import type { INotificationChannel, SendPayload } from '../../interfaces/notification-channel.interface.js';

const FCM_BATCH_SIZE = 500; // límite de la API de FCM

@Injectable()
export class PushAdapter implements INotificationChannel, OnModuleInit {
  private readonly logger = new Logger(PushAdapter.name);
  private firebaseApp!: App;
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase no configurado — Push deshabilitado');
      return;
    }

    try {
      // Importar firebase-admin dinámicamente para no romper si no está configurado
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');

      // Evitar re-inicialización en hot reload
      const appName = 'notificaciones-backend';
      const existing = getApps().find(a => a.name === appName);

      this.firebaseApp = existing ?? initializeApp(
        {
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        },
        appName,
      );

      this.configured = true;
      this.logger.log('Firebase Admin inicializado para Push');
    } catch (e: unknown) {
      this.logger.error(`Error inicializando Firebase: ${String(e)}`);
    }
  }

  get channel(): 'PUSH' { return 'PUSH'; }

  isConfigured(): boolean { return this.configured; }

  async send(payload: SendPayload): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('FCM no configurado — revisar FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    }

    // payload.to puede ser un único token o tokens separados por coma (batch)
    const tokens = payload.to.split(',').map(t => t.trim()).filter(Boolean);

    if (tokens.length === 0) throw new Error('Sin FCM tokens para enviar');

    if (tokens.length === 1) {
      await this.sendSingle(tokens[0]!, payload);
    } else {
      await this.sendBatch(tokens, payload);
    }
  }

  // ── Single send ──────────────────────────────────────────────────────────

  private async sendSingle(token: string, payload: SendPayload): Promise<void> {
    const { getMessaging } = await import('firebase-admin/messaging');
    const messaging = getMessaging(this.firebaseApp);

    const message: Message = {
      token,
      notification: {
        title: payload.subject ?? this.titleFromTemplate(payload.templateKey),
        body:  payload.body,
      },
      data: this.buildDataPayload(payload),
      android: { priority: 'high' },
      apns:    { payload: { aps: { sound: 'default' } } },
    };

    try {
      const msgId = await messaging.send(message);
      this.logger.debug(`Push enviado — msgId: ${msgId}`);
    } catch (e: unknown) {
      await this.handleFcmError(e, [token]);
      throw e;
    }
  }

  // ── Batch send (hasta 500 tokens por llamada) ────────────────────────────

  private async sendBatch(tokens: string[], payload: SendPayload): Promise<void> {
    const { getMessaging } = await import('firebase-admin/messaging');
    const messaging = getMessaging(this.firebaseApp);

    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
      const batch = tokens.slice(i, i + FCM_BATCH_SIZE);

      const message: MulticastMessage = {
        tokens: batch,
        notification: {
          title: payload.subject ?? this.titleFromTemplate(payload.templateKey),
          body:  payload.body,
        },
        data:    this.buildDataPayload(payload),
        android: { priority: 'high' },
        apns:    { payload: { aps: { sound: 'default' } } },
      };

      const result = await messaging.sendEachForMulticast(message);

      const invalidTokens: string[] = [];
      result.responses.forEach((r, idx) => {
        if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(batch[idx]!);
        }
      });

      if (invalidTokens.length > 0) {
        this.logger.warn(
          `${invalidTokens.length} tokens FCM inválidos detectados — limpiar en DB del caller`,
        );
        // Emitir warning con los tokens inválidos para que el caller los limpie
        // No lanzamos error — los tokens válidos ya se enviaron
      }

      const failed = result.failureCount - invalidTokens.length;
      if (failed > 0) {
        this.logger.warn(`${failed} envíos fallidos en batch FCM (excluidos tokens inválidos)`);
      }

      this.logger.debug(
        `Batch FCM: ${result.successCount} ok, ${result.failureCount} fallidos de ${batch.length}`,
      );
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildDataPayload(payload: SendPayload): Record<string, string> {
    const data: Record<string, string> = {
      templateKey: payload.templateKey ?? '',
    };

    // Aplanar meta como strings (FCM solo acepta string values en data)
    if (payload.meta) {
      for (const [k, v] of Object.entries(payload.meta)) {
        data[k] = String(v);
      }
    }

    return data;
  }

  private titleFromTemplate(templateKey?: string): string {
    const titles: Record<string, string> = {
      'conversation.new':  'Nueva conversación',
      'message.new':       'Nuevo mensaje',
      'escalation.alert':  '⚠️ Escalación',
    };
    return titles[templateKey ?? ''] ?? 'Notificación';
  }

  private async handleFcmError(e: unknown, tokens: string[]): Promise<void> {
    const code = (e as { errorInfo?: { code?: string } })?.errorInfo?.code;
    if (code === 'messaging/registration-token-not-registered') {
      this.logger.warn(`Token FCM inválido: ${tokens[0]?.substring(0, 20)}...`);
    }
  }
}
