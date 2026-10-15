import { randomBytes } from 'node:crypto';
import {
  parseEncryptionKey,
  TokenCipher,
} from '@/infrastructure/security/token-cipher.js';

const key = (): string => randomBytes(32).toString('base64');

describe('TokenCipher', () => {
  it('cifra y descifra (ida y vuelta) y el valor cifrado no contiene el secreto', () => {
    const cipher = TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: key() });
    const enc = cipher.encrypt('EAAG-token-de-meta');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc).not.toContain('EAAG');
    expect(cipher.decrypt(enc)).toBe('EAAG-token-de-meta');
  });

  it('el mismo texto cifra distinto cada vez (IV aleatorio)', () => {
    const cipher = TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: key() });
    expect(cipher.encrypt('x')).not.toBe(cipher.encrypt('x'));
  });

  it('es idempotente: no cifra dos veces un valor ya cifrado', () => {
    const cipher = TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: key() });
    const enc = cipher.encrypt('secreto');
    expect(cipher.encrypt(enc)).toBe(enc);
  });

  it('valores en texto plano anteriores al cifrado se leen igual (migración gradual)', () => {
    const cipher = TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: key() });
    expect(cipher.decrypt('token-viejo-en-claro')).toBe('token-viejo-en-claro');
  });

  it('sin clave configurada no cifra (desarrollo) y lo informa', () => {
    const cipher = TokenCipher.fromEnv({});
    expect(cipher.enabled).toBe(false);
    expect(cipher.encrypt('abc')).toBe('abc');
  });

  it('un dato alterado NO se descifra (GCM autentica)', () => {
    const cipher = TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: key() });
    const enc = cipher.encrypt('secreto');
    const parts = enc.split(':');
    parts[4] = Buffer.from('otro-contenido').toString('base64url');
    expect(() => cipher.decrypt(parts.join(':'))).toThrow(/descifrar/);
  });

  it('con otra clave no se puede descifrar', () => {
    const enc = TokenCipher.fromEnv({
      CHANNEL_TOKEN_ENCRYPTION_KEY: key(),
    }).encrypt('secreto');
    expect(() =>
      TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: key() }).decrypt(enc),
    ).toThrow(/descifrar/);
  });

  it('rotación: la clave anterior sigue descifrando; lo nuevo se cifra con la vigente', () => {
    const oldKey = key();
    const newKey = key();
    const enc = TokenCipher.fromEnv({
      CHANNEL_TOKEN_ENCRYPTION_KEY: oldKey,
    }).encrypt('secreto');

    const rotated = TokenCipher.fromEnv({
      CHANNEL_TOKEN_ENCRYPTION_KEY: newKey,
      CHANNEL_TOKEN_ENCRYPTION_KEY_PREVIOUS: oldKey,
    });
    expect(rotated.decrypt(enc)).toBe('secreto');

    const fresh = rotated.encrypt('nuevo');
    expect(
      TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: newKey }).decrypt(
        fresh,
      ),
    ).toBe('nuevo');
    expect(() =>
      TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: oldKey }).decrypt(
        fresh,
      ),
    ).toThrow();
  });

  it('rechaza claves de largo incorrecto con un mensaje claro', () => {
    expect(() =>
      TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: 'corta' }),
    ).toThrow(/32 bytes/);
    expect(parseEncryptionKey(randomBytes(16).toString('base64'))).toBeNull();
  });

  it('acepta la clave en hex', () => {
    const hex = randomBytes(32).toString('hex');
    const cipher = TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: hex });
    expect(cipher.decrypt(cipher.encrypt('x'))).toBe('x');
  });

  it('cifra y descifra solo el appSecret dentro de extraConfig', () => {
    const cipher = TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: key() });
    const enc = cipher.encryptExtraConfig({ wabaId: '1', appSecret: 's3cret' });
    expect(enc['wabaId']).toBe('1');
    expect(String(enc['appSecret'])).toMatch(/^enc:v1:/);
    expect(cipher.decryptExtraConfig(enc)).toEqual({
      wabaId: '1',
      appSecret: 's3cret',
    });
    expect(cipher.encryptExtraConfig({ wabaId: '1' })).toEqual({ wabaId: '1' });
  });

  it('un secreto vacío no se cifra', () => {
    expect(
      TokenCipher.fromEnv({ CHANNEL_TOKEN_ENCRYPTION_KEY: key() }).encrypt(''),
    ).toBe('');
  });
});
