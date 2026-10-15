import { UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import { WebhooksService } from '@/core/webhooks/webhooks.service.js';
import { WhatsAppChannel } from '@/infrastructure/channels/whatsapp/whatsapp.channel.js';
import type { ChannelRegistry } from '@/infrastructure/channels/channel.registry.js';

const APP_SECRET = 'meta-app-secret-de-prueba';
const BODY = Buffer.from(
  JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: 'wamid.1',
                  from: '5491100000000',
                  type: 'text',
                  text: { body: 'hola' },
                  timestamp: '1700000000',
                },
              ],
              contacts: [{ profile: { name: 'Ana' } }],
            },
          },
        ],
      },
    ],
  }),
);
const sign = (body: Buffer, secret = APP_SECRET): string =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('WebhooksService — autenticidad de webhooks', () => {
  const accounts = { findByChannel: jest.fn() };
  const queue = { add: jest.fn() };
  const registry = { get: jest.fn() } as unknown as ChannelRegistry;
  let service: WebhooksService;
  let cipher: TokenCipher;

  const account = {
    id: 'acc-1',
    externalId: 'pn-1',
    extraConfig: {},
    webhookVerifyToken: 'verify-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['META_APP_SECRET'] = APP_SECRET;
    accounts.findByChannel.mockResolvedValue(account);
    (registry.get as jest.Mock).mockReturnValue(new WhatsAppChannel());
    cipher = TokenCipher.fromEnv({
      CHANNEL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    });
    service = new WebhooksService(
      accounts as never,
      registry,
      queue as never,
      cipher,
    );
  });

  afterEach(() => {
    delete process.env['META_APP_SECRET'];
  });

  it('acepta un webhook con firma válida y encola el mensaje con jobId idempotente', async () => {
    const res = await service.handleEvent(
      'WHATSAPP',
      'pn-1',
      JSON.parse(BODY.toString()),
      BODY,
      sign(BODY),
    );
    expect(res).toEqual({ status: 'ok' });
    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ channelAccountId: 'acc-1' }),
      expect.objectContaining({ jobId: 'msg_acc-1_wamid.1' }),
    );
  });

  it('rechaza (401) un webhook SIN header de firma — antes pasaba sin verificar', async () => {
    await expect(
      service.handleEvent('WHATSAPP', 'pn-1', {}, BODY, undefined),
    ).rejects.toThrow(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rechaza una firma hecha con otro secreto', async () => {
    await expect(
      service.handleEvent(
        'WHATSAPP',
        'pn-1',
        {},
        BODY,
        sign(BODY, 'otro-secreto'),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rechaza si el cuerpo fue alterado después de firmar', async () => {
    const tampered = Buffer.from(BODY.toString().replace('hola', 'chau'));
    await expect(
      service.handleEvent('WHATSAPP', 'pn-1', {}, tampered, sign(BODY)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza si no hay cuerpo crudo (rawBody desactivado)', async () => {
    await expect(
      service.handleEvent('WHATSAPP', 'pn-1', {}, undefined, sign(BODY)),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.handleEvent('WHATSAPP', 'pn-1', {}, Buffer.alloc(0), sign(BODY)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('falla cerrado si el canal no tiene App Secret configurado', async () => {
    delete process.env['META_APP_SECRET'];
    await expect(
      service.handleEvent('WHATSAPP', 'pn-1', {}, BODY, sign(BODY)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('usa el App Secret propio de la cuenta (extraConfig.appSecret) por encima del de plataforma', async () => {
    accounts.findByChannel.mockResolvedValue({
      ...account,
      extraConfig: { appSecret: 'secreto-de-la-org' },
    });
    const res = await service.handleEvent(
      'WHATSAPP',
      'pn-1',
      JSON.parse(BODY.toString()),
      BODY,
      sign(BODY, 'secreto-de-la-org'),
    );
    expect(res).toEqual({ status: 'ok' });
  });

  it('el appSecret propio de la cuenta se guarda CIFRADO y la firma igual se valida', async () => {
    accounts.findByChannel.mockResolvedValue({
      ...account,
      extraConfig: { appSecret: cipher.encrypt('secreto-de-la-org') },
    });
    const res = await service.handleEvent(
      'WHATSAPP',
      'pn-1',
      JSON.parse(BODY.toString()),
      BODY,
      sign(BODY, 'secreto-de-la-org'),
    );
    expect(res).toEqual({ status: 'ok' });
  });

  it('NO acepta una firma calculada con el verify token (el bug anterior)', async () => {
    await expect(
      service.handleEvent(
        'WHATSAPP',
        'pn-1',
        {},
        BODY,
        sign(BODY, 'verify-token'),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('cuenta inexistente → 401', async () => {
    accounts.findByChannel.mockResolvedValue(null);
    await expect(
      service.handleEvent('WHATSAPP', 'nope', {}, BODY, sign(BODY)),
    ).rejects.toThrow(UnauthorizedException);
  });
});
