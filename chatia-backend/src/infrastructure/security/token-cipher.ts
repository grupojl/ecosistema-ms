// src/infrastructure/security/token-cipher.ts
//
// Cifrado en reposo (AES-256-GCM) de secretos de canales: ChannelAccount.accessToken y extraConfig.appSecret.
// Antes se guardaban en texto plano: una fuga de la base (backup, réplica, SQL injection) exponía los tokens
// de WhatsApp/Instagram/Messenger de todas las organizaciones.
//
// Formato: enc:v1:<iv>:<tag>:<ciphertext>  (base64url). GCM autentica: si alguien altera el valor, descifrar falla.
// Compatibilidad: valores SIN prefijo (datos anteriores al cifrado) se leen tal cual → se puede activar sin migrar a la fuerza
// (después se cifran los existentes con `pnpm encrypt:tokens`).
// Rotación: CHANNEL_TOKEN_ENCRYPTION_KEY (vigente, cifra) + CHANNEL_TOKEN_ENCRYPTION_KEY_PREVIOUS (solo descifra).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';
const IV_BYTES = 12;

/** Acepta 32 bytes en base64 (44 chars) o en hex (64 chars). Devuelve null si no es una clave válida. */
export function parseEncryptionKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const value = raw.trim();
  const buf = /^[0-9a-fA-F]{64}$/.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  return buf.length === 32 ? buf : null;
}

export class TokenCipher {
  constructor(private readonly keys: Buffer[]) {}

  static fromEnv(
    env: Record<string, string | undefined> = process.env,
  ): TokenCipher {
    const current = env['CHANNEL_TOKEN_ENCRYPTION_KEY'];
    const previous = env['CHANNEL_TOKEN_ENCRYPTION_KEY_PREVIOUS'];
    const keys: Buffer[] = [];
    for (const [name, raw] of [
      ['CHANNEL_TOKEN_ENCRYPTION_KEY', current],
      ['CHANNEL_TOKEN_ENCRYPTION_KEY_PREVIOUS', previous],
    ] as const) {
      if (!raw) continue;
      const key = parseEncryptionKey(raw);
      if (!key)
        throw new Error(
          `${name} inválida: debe ser una clave de 32 bytes en base64 o hex (openssl rand -base64 32)`,
        );
      keys.push(key);
    }
    return new TokenCipher(keys);
  }

  /** Sin clave configurada no se cifra (desarrollo); en producción la clave es obligatoria (validación de entorno). */
  get enabled(): boolean {
    return this.keys.length > 0;
  }

  isEncrypted(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.startsWith(PREFIX);
  }

  encrypt(plain: string): string {
    const key = this.keys[0];
    if (!key || !plain || this.isEncrypted(plain)) return plain;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `${PREFIX}${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${data.toString('base64url')}`;
  }

  /** Descifra. Un valor sin prefijo (anterior al cifrado) se devuelve igual. Lanza si está cifrado y no se puede abrir. */
  decrypt(value: string): string {
    if (!this.isEncrypted(value)) return value;
    const [iv, tag, data] = value.slice(PREFIX.length).split(':');
    if (!iv || !tag || !data)
      throw new Error('Valor cifrado con formato inválido');

    for (const key of this.keys) {
      try {
        const decipher = createDecipheriv(
          'aes-256-gcm',
          key,
          Buffer.from(iv, 'base64url'),
        );
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([
          decipher.update(Buffer.from(data, 'base64url')),
          decipher.final(),
        ]).toString('utf8');
      } catch {
        // probar con la clave anterior (rotación)
      }
    }
    throw new Error(
      'No se pudo descifrar el valor: clave incorrecta o dato alterado',
    );
  }

  /** Cifra los secretos conocidos dentro de extraConfig (hoy: appSecret). */
  encryptExtraConfig(extra: Record<string, unknown>): Record<string, unknown> {
    const secret = extra['appSecret'];
    return typeof secret === 'string'
      ? { ...extra, appSecret: this.encrypt(secret) }
      : extra;
  }

  decryptExtraConfig(extra: Record<string, unknown>): Record<string, unknown> {
    const secret = extra['appSecret'];
    return typeof secret === 'string'
      ? { ...extra, appSecret: this.decrypt(secret) }
      : extra;
  }
}
