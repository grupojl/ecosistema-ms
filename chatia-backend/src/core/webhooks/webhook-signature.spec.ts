import { resolveSignatureSecret } from '@/core/webhooks/webhook-signature.js';

describe('resolveSignatureSecret', () => {
  const env = {
    META_APP_SECRET: 'meta-global',
    TIKTOK_APP_SECRET: 'tt-global',
  };

  it('Meta usa META_APP_SECRET para WhatsApp, Instagram y Messenger', () => {
    for (const ch of ['WHATSAPP', 'INSTAGRAM', 'MESSENGER'] as const) {
      expect(resolveSignatureSecret(ch, {}, env)).toBe('meta-global');
    }
  });

  it('TikTok usa TIKTOK_APP_SECRET', () => {
    expect(resolveSignatureSecret('TIKTOK', {}, env)).toBe('tt-global');
  });

  it('el secreto propio de la cuenta tiene prioridad', () => {
    expect(
      resolveSignatureSecret('WHATSAPP', { appSecret: 'propio' }, env),
    ).toBe('propio');
  });

  it('sin secreto devuelve null (el servicio rechaza)', () => {
    expect(resolveSignatureSecret('WHATSAPP', {}, {})).toBeNull();
    expect(resolveSignatureSecret('WHATSAPP', null, {})).toBeNull();
    expect(
      resolveSignatureSecret('WHATSAPP', { appSecret: '' }, {}),
    ).toBeNull();
  });
});
