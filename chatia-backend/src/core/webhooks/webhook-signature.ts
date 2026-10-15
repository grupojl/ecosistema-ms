// src/core/webhooks/webhook-signature.ts
//
// Resolución del secreto con el que el canal firma sus webhooks.
// Meta (WhatsApp/Instagram/Messenger) firma con el **App Secret** de la app de Meta, no con el
// verify token. Prioridad: secreto propio de la cuenta (extraConfig.appSecret, para orgs con su
// propia app de Meta) → variable de plataforma (META_APP_SECRET / TIKTOK_APP_SECRET).
import type { ChannelType } from '@/generated/prisma/client.js';

const PLATFORM_SECRET_ENV: Partial<Record<ChannelType, string>> = {
  WHATSAPP: 'META_APP_SECRET',
  INSTAGRAM: 'META_APP_SECRET',
  MESSENGER: 'META_APP_SECRET',
  TIKTOK: 'TIKTOK_APP_SECRET',
};

export function resolveSignatureSecret(
  channelType: ChannelType,
  extraConfig: unknown,
  env: Record<string, string | undefined> = process.env,
  /** Descifra el secreto propio de la cuenta (se guarda cifrado en reposo). */
  decrypt: (value: string) => string = (v) => v,
): string | null {
  const own = (extraConfig as { appSecret?: unknown } | null | undefined)
    ?.appSecret;
  if (typeof own === 'string' && own.length > 0) return decrypt(own);

  const envName = PLATFORM_SECRET_ENV[channelType];
  const platform = envName ? env[envName] : undefined;
  return platform && platform.length > 0 ? platform : null;
}
