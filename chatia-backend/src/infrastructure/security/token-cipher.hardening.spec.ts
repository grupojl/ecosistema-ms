// Endurecimiento del cifrado de secretos: formato exacto, validación estricta de la clave, valores mal formados
// y tipos inesperados. Un fallo silencioso acá guarda tokens de canales en texto plano o los vuelve ilegibles.
import { randomBytes } from 'node:crypto';
import {
  parseEncryptionKey,
  TokenCipher,
} from '@/infrastructure/security/token-cipher.js';

const K = () => randomBytes(32);
const cipher = () => new TokenCipher([K()]);

describe('parseEncryptionKey — estricta', () => {
  it('acepta base64 y hex de 32 bytes y tolera espacios alrededor', () => {
    const k = K();
    expect(parseEncryptionKey(k.toString('hex'))?.equals(k)).toBe(true);
    expect(parseEncryptionKey(k.toString('base64'))?.equals(k)).toBe(true);
    expect(parseEncryptionKey(`  ${k.toString('hex')}\n`)?.equals(k)).toBe(
      true,
    );
    expect(parseEncryptionKey(`\t${k.toString('base64')} `)?.equals(k)).toBe(
      true,
    );
  });

  it('el hex debe ser EXACTAMENTE 64 caracteres: basura antes o después no se reinterpreta', () => {
    const hex = K().toString('hex');
    // con basura delante o detrás deja de ser hex y se lee como base64 → no da 32 bytes → inválida
    expect(parseEncryptionKey(`zz${hex}`)).toBeNull();
    expect(parseEncryptionKey(`${hex}zz`)).toBeNull();
    expect(parseEncryptionKey(`${hex}00`)).toBeNull();
  });

  it.each([
    undefined,
    '',
    'corta',
    'a'.repeat(63),
    Buffer.alloc(31).toString('base64'),
    Buffer.alloc(33).toString('base64'),
  ])('una clave inválida (%p) devuelve null', (raw) => {
    expect(parseEncryptionKey(raw)).toBeNull();
  });
});

describe('TokenCipher — formato y bordes', () => {
  it('el valor cifrado tiene EXACTAMENTE el formato enc:v1:<iv>:<tag>:<datos>', () => {
    const enc = cipher().encrypt('token-secreto');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    const parts = enc.slice('enc:v1:'.length).split(':');
    expect(parts).toHaveLength(3);
    for (const p of parts) expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(parts[0]!, 'base64url')).toHaveLength(12); // IV de 96 bits
    expect(Buffer.from(parts[1]!, 'base64url')).toHaveLength(16); // etiqueta GCM de 128 bits
    expect(enc).not.toContain('token-secreto');
  });

  it('el cifrado conserva caracteres no ASCII (UTF-8) en la ida y vuelta', () => {
    const c = cipher();
    const plain = 'clave-ñandú-€-日本語';
    expect(c.decrypt(c.encrypt(plain))).toBe(plain);
  });

  describe('isEncrypted', () => {
    const c = cipher();
    it('solo es true para strings con el prefijo', () => {
      expect(c.isEncrypted(c.encrypt('x'))).toBe(true);
      expect(c.isEncrypted('enc:v1:')).toBe(true);
      expect(c.isEncrypted('plano')).toBe(false);
      expect(c.isEncrypted('xenc:v1:abc')).toBe(false);
      expect(c.isEncrypted('')).toBe(false);
      expect(c.isEncrypted(null)).toBe(false);
      expect(c.isEncrypted(undefined)).toBe(false);
    });
    it('un valor que no es string nunca se considera cifrado (aunque tenga startsWith)', () => {
      const fake = { startsWith: () => true } as unknown as string;
      expect(c.isEncrypted(fake)).toBe(false);
    });
  });

  describe('decrypt con formato inválido', () => {
    const c = cipher();
    it.each([
      ['sin partes', 'enc:v1:'],
      ['solo iv', 'enc:v1:aaaa'],
      ['iv y tag sin datos', 'enc:v1:aaaa:bbbb'],
      ['iv vacío', 'enc:v1::bbbb:cccc'],
      ['tag vacío', 'enc:v1:aaaa::cccc'],
      ['datos vacíos', 'enc:v1:aaaa:bbbb:'],
    ])('%s → "formato inválido" (no "clave incorrecta")', (_n, value) => {
      expect(() => c.decrypt(value)).toThrow(
        'Valor cifrado con formato inválido',
      );
    });

    it('un valor bien formado pero alterado se rechaza como dato alterado', () => {
      const enc = c.encrypt('secreto');
      const [iv, tag, data] = enc.slice('enc:v1:'.length).split(':');
      const flipped = Buffer.from(data!, 'base64url');
      flipped[0] = flipped[0]! ^ 0xff;
      expect(() =>
        c.decrypt(`enc:v1:${iv}:${tag}:${flipped.toString('base64url')}`),
      ).toThrow(/No se pudo descifrar/);
    });
  });

  describe('extraConfig', () => {
    const c = cipher();
    it('un appSecret que no es string (número, null, ausente) se deja intacto, sin cifrar ni romper', () => {
      for (const extra of [
        { appSecret: 123 },
        { appSecret: null },
        { otro: 1 },
      ]) {
        expect(c.encryptExtraConfig(extra)).toBe(extra);
        expect(c.decryptExtraConfig(extra)).toBe(extra);
      }
    });

    it('conserva el resto de los campos al cifrar y descifrar el appSecret', () => {
      const enc = c.encryptExtraConfig({ appSecret: 's', region: 'ar' });
      expect(enc['region']).toBe('ar');
      expect(c.isEncrypted(enc['appSecret'] as string)).toBe(true);
      expect(c.decryptExtraConfig(enc)).toEqual({
        appSecret: 's',
        region: 'ar',
      });
    });
  });
});
