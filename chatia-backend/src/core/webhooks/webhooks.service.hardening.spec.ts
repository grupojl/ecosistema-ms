// Endurecimiento de WebhooksService: la TRAZA de seguridad (qué se rechazó y por qué queda en el log aunque el
// cliente reciba un 401 uniforme), la lista vacía de mensajes y las opciones de reintento del job.
import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import { WebhooksService } from '@/core/webhooks/webhooks.service.js';
import { WhatsAppChannel } from '@/infrastructure/channels/whatsapp/whatsapp.channel.js';

const SECRET = 'secreto-hardening';
const body = Buffer.from(
  JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: 'wamid.h1',
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
const sign = (b: Buffer): string =>
  `sha256=${createHmac('sha256', SECRET).update(b).digest('hex')}`;

describe('WebhooksService — traza y bordes', () => {
  const accounts = { findByChannel: jest.fn() };
  const queue = { add: jest.fn() };
  const registry = { get: jest.fn() };
  const account = {
    id: 'acc-1',
    externalId: 'pn-1',
    accessToken: 'tok',
    extraConfig: {},
    webhookVerifyToken: 'verify-ok',
  };
  let svc: WebhooksService;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['META_APP_SECRET'] = SECRET;
    accounts.findByChannel.mockResolvedValue(account);
    registry.get.mockReturnValue(new WhatsAppChannel());
    queue.add.mockResolvedValue(undefined);
    svc = new WebhooksService(
      accounts as never,
      registry as never,
      queue as never,
      TokenCipher.fromEnv({}),
    );
    const logger = (
      svc as unknown as {
        logger: { warn: (m: string) => void; error: (m: string) => void };
      }
    ).logger;
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => delete process.env['META_APP_SECRET']);

  const reasonOf = async (run: () => Promise<unknown>): Promise<string> => {
    warn.mockClear();
    await expect(run()).rejects.toBeInstanceOf(UnauthorizedException);
    const line = warn.mock.calls
      .map((c) => String(c[0]))
      .find((m) => m.startsWith('Webhook rechazado: '));
    return line ?? '(sin traza)';
  };

  it('cada causa de rechazo deja SU motivo en el log (el cliente solo ve 401 uniforme)', async () => {
    accounts.findByChannel.mockResolvedValueOnce(null);
    expect(
      await reasonOf(() =>
        svc.handleEvent('WHATSAPP', 'x', {}, body, sign(body)),
      ),
    ).toBe('Webhook rechazado: Cuenta inexistente');

    expect(
      await reasonOf(() =>
        svc.handleEvent('WHATSAPP', 'pn-1', {}, body, undefined),
      ),
    ).toBe('Webhook rechazado: Firma ausente');

    expect(
      await reasonOf(() =>
        svc.handleEvent('WHATSAPP', 'pn-1', {}, undefined, sign(body)),
      ),
    ).toBe('Webhook rechazado: Cuerpo crudo no disponible');

    expect(
      await reasonOf(() =>
        svc.handleEvent('WHATSAPP', 'pn-1', {}, Buffer.alloc(0), sign(body)),
      ),
    ).toBe('Webhook rechazado: Cuerpo crudo no disponible');

    expect(
      await reasonOf(() =>
        svc.handleEvent('WHATSAPP', 'pn-1', {}, body, 'sha256=00'),
      ),
    ).toBe('Webhook rechazado: Firma inválida');

    delete process.env['META_APP_SECRET'];
    expect(
      await reasonOf(() =>
        svc.handleEvent('WHATSAPP', 'pn-1', {}, body, sign(body)),
      ),
    ).toBe('Webhook rechazado: Canal sin secreto de firma configurado');
  });

  it('una firma inválida deja además el canal y la cuenta en el log (para detectar ataques)', async () => {
    await expect(
      svc.handleEvent('WHATSAPP', 'pn-1', {}, body, 'sha256=00'),
    ).rejects.toThrow(UnauthorizedException);
    expect(
      warn.mock.calls.some(
        (c) => String(c[0]) === 'Firma inválida en webhook WHATSAPP/pn-1',
      ),
    ).toBe(true);
  });

  it('la falta de App Secret se registra como ALERTA TÉCNICA (es un error de configuración, no de un atacante)', async () => {
    delete process.env['META_APP_SECRET'];
    await expect(
      svc.handleEvent('WHATSAPP', 'pn-1', {}, body, sign(body)),
    ).rejects.toThrow(UnauthorizedException);
    const msg = String(error.mock.calls[0]?.[0]);
    expect(msg).toContain('[ALERTA TÉCNICA]');
    expect(msg).toContain('WHATSAPP');
    expect(msg).toContain('META_APP_SECRET');
  });

  it('un canal sin verificación de firma deja su motivo en el log', async () => {
    registry.get.mockReturnValue({
      parseIncomingWebhook: jest.fn(),
      verifySignature: undefined,
    });
    expect(
      await reasonOf(() =>
        svc.handleEvent('WHATSAPP', 'pn-1', {}, body, sign(body)),
      ),
    ).toBe('Webhook rechazado: Canal sin verificación de firma');
  });

  it('verify: cuenta inexistente y token inválido dejan su motivo', async () => {
    accounts.findByChannel.mockResolvedValueOnce(null);
    expect(await reasonOf(() => svc.verify('WHATSAPP', 'x', {}))).toBe(
      'Webhook rechazado: Cuenta inexistente',
    );
    expect(
      await reasonOf(() =>
        svc.verify('WHATSAPP', 'pn-1', {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'otro',
          'hub.challenge': 'c',
        }),
      ),
    ).toBe('Webhook rechazado: Token inválido');
  });

  it('firma válida pero el canal devuelve una LISTA VACÍA de mensajes → "ignored" y no encola', async () => {
    registry.get.mockReturnValue({
      verifySignature: () => true,
      parseIncomingWebhook: () => [],
    });
    await expect(
      svc.handleEvent('WHATSAPP', 'pn-1', {}, body, sign(body)),
    ).resolves.toEqual({ status: 'ignored' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('con la cola deshabilitada deja un aviso explícito (no se pierde en silencio)', async () => {
    const noQueue = new WebhooksService(
      accounts as never,
      registry as never,
      null as never,
      TokenCipher.fromEnv({}),
    );
    const w = jest
      .spyOn(
        (noQueue as unknown as { logger: { warn: (m: string) => void } })
          .logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    await noQueue.handleEvent(
      'WHATSAPP',
      'pn-1',
      JSON.parse(body.toString()),
      body,
      sign(body),
    );
    expect(String(w.mock.calls[0]?.[0])).toContain(
      '[no-op] webhook recibido pero cola deshabilitada',
    );
  });

  it('cada mensaje se encola con 3 intentos y retroceso exponencial de 2 s', async () => {
    await svc.handleEvent(
      'WHATSAPP',
      'pn-1',
      JSON.parse(body.toString()),
      body,
      sign(body),
    );
    expect(queue.add.mock.calls[0]?.[2]).toEqual({
      jobId: 'msg_acc-1_wamid.h1',
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  });
});
