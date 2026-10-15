// Qué secreto firma cada canal: un error acá acepta webhooks falsos o rechaza los reales. Los casos fijan el
// resultado EXACTO (null, no undefined ni cadena vacía) y que no se mezclen secretos entre plataformas.
import { resolveSignatureSecret } from '@/core/webhooks/webhook-signature.js';

describe('resolveSignatureSecret — estricto', () => {
  it.each(['WHATSAPP', 'INSTAGRAM', 'MESSENGER'] as const)(
    '%s usa META_APP_SECRET y NO el de TikTok',
    (ch) => {
      expect(
        resolveSignatureSecret(ch, null, {
          META_APP_SECRET: 'meta',
          TIKTOK_APP_SECRET: 'tiktok',
        }),
      ).toBe('meta');
      expect(
        resolveSignatureSecret(ch, null, { TIKTOK_APP_SECRET: 'tiktok' }),
      ).toBeNull();
    },
  );

  it('TIKTOK usa TIKTOK_APP_SECRET y NO el de Meta', () => {
    expect(
      resolveSignatureSecret('TIKTOK', null, {
        META_APP_SECRET: 'meta',
        TIKTOK_APP_SECRET: 'tiktok',
      }),
    ).toBe('tiktok');
    expect(
      resolveSignatureSecret('TIKTOK', null, { META_APP_SECRET: 'meta' }),
    ).toBeNull();
  });

  it('sin secreto devuelve null exacto (el servicio rechaza en fail-closed)', () => {
    expect(resolveSignatureSecret('WHATSAPP', null, {})).toBeNull();
    expect(resolveSignatureSecret('WHATSAPP', {}, {})).toBeNull();
    expect(resolveSignatureSecret('WHATSAPP', undefined, {})).toBeNull();
  });

  it('una variable de entorno vacía cuenta como ausente', () => {
    expect(
      resolveSignatureSecret('WHATSAPP', null, { META_APP_SECRET: '' }),
    ).toBeNull();
  });

  it('un canal sin variable de plataforma definida no tiene secreto de plataforma', () => {
    expect(
      resolveSignatureSecret('OTRO' as never, null, { META_APP_SECRET: 'x' }),
    ).toBeNull();
  });

  describe('secreto propio de la cuenta', () => {
    it('gana sobre el de plataforma y se descifra con la función recibida', () => {
      const decrypt = jest.fn((v: string) => `plain(${v})`);
      expect(
        resolveSignatureSecret(
          'WHATSAPP',
          { appSecret: 'cifrado' },
          { META_APP_SECRET: 'meta' },
          decrypt,
        ),
      ).toBe('plain(cifrado)');
      expect(decrypt).toHaveBeenCalledTimes(1);
      expect(decrypt).toHaveBeenCalledWith('cifrado');
    });

    it('el de plataforma NO pasa por decrypt', () => {
      const decrypt = jest.fn((v: string) => `plain(${v})`);
      expect(
        resolveSignatureSecret(
          'WHATSAPP',
          {},
          { META_APP_SECRET: 'meta' },
          decrypt,
        ),
      ).toBe('meta');
      expect(decrypt).not.toHaveBeenCalled();
    });

    it.each([
      ['vacío', ''],
      ['número', 123],
      ['objeto', {}],
      ['null', null],
    ])(
      'un appSecret propio inválido (%s) se ignora y se usa el de plataforma',
      (_n, own) => {
        expect(
          resolveSignatureSecret(
            'WHATSAPP',
            { appSecret: own },
            { META_APP_SECRET: 'meta' },
          ),
        ).toBe('meta');
      },
    );

    it('sin función decrypt el valor propio se devuelve tal cual', () => {
      expect(
        resolveSignatureSecret('WHATSAPP', { appSecret: 'claro' }, {}),
      ).toBe('claro');
    });
  });
});
