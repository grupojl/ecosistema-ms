// Webhook ÚNICO de la app de Meta (Tech Provider, ADR-024): una sola URL para todos los clientes; el número sale del
// payload y la firma se valida con el App Secret de la plataforma.
import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import { WebhooksService } from '@/core/webhooks/webhooks.service.js';
import { WhatsAppChannel } from '@/infrastructure/channels/whatsapp/whatsapp.channel.js';

const SECRET = 'secreto-plataforma';
const change = (phoneNumberId: string, id: string) => ({
  field: 'messages',
  value: {
    metadata: { phone_number_id: phoneNumberId },
    messages: [
      {
        id,
        from: '5491100000000',
        type: 'text',
        text: { body: 'hola' },
        timestamp: '1700000000',
      },
    ],
    contacts: [{ wa_id: '5491100000000', profile: { name: 'Ana' } }],
  },
});
const payloadOf = (...changes: unknown[]) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'waba-1', changes }],
});
const raw = (p: unknown) => Buffer.from(JSON.stringify(p));
const sign = (b: Buffer) =>
  `sha256=${createHmac('sha256', SECRET).update(b).digest('hex')}`;

describe('WebhooksService — webhook único de plataforma', () => {
  const accounts = { findByChannel: jest.fn() };
  const queue = { add: jest.fn() };
  const registry = { get: jest.fn() };
  let svc: WebhooksService;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env['META_APP_SECRET'] = SECRET;
    process.env['META_WEBHOOK_VERIFY_TOKEN'] = 'verify-plataforma';
    registry.get.mockReturnValue(new WhatsAppChannel());
    queue.add.mockResolvedValue(undefined);
    svc = new WebhooksService(
      accounts as never,
      registry as never,
      queue as never,
      TokenCipher.fromEnv({}),
    );
    jest
      .spyOn(
        (svc as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    delete process.env['META_APP_SECRET'];
    delete process.env['META_WEBHOOK_VERIFY_TOKEN'];
  });

  describe('verifyPlatform', () => {
    const q = (token: string) => ({
      'hub.mode': 'subscribe',
      'hub.verify_token': token,
      'hub.challenge': 'abc123',
    });

    it('devuelve el challenge con el verify token de plataforma', () => {
      expect(svc.verifyPlatform(q('verify-plataforma'))).toBe('abc123');
    });

    it('rechaza token incorrecto y falla cerrado sin variable', () => {
      expect(() => svc.verifyPlatform(q('otro'))).toThrow(
        UnauthorizedException,
      );
      delete process.env['META_WEBHOOK_VERIFY_TOKEN'];
      expect(() => svc.verifyPlatform(q('verify-plataforma'))).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('handlePlatformEvent', () => {
    it('enruta cada cambio a la cuenta dueña de su phone_number_id', async () => {
      accounts.findByChannel.mockImplementation((_t: string, id: string) =>
        Promise.resolve({ id: `acc-${id}`, isActive: true }),
      );
      const p = payloadOf(change('pn-A', 'wamid.A'), change('pn-B', 'wamid.B'));
      const b = raw(p);

      const res = await svc.handlePlatformEvent(p, b, sign(b));

      expect(res).toEqual({ status: 'ok' });
      expect(accounts.findByChannel).toHaveBeenCalledWith('WHATSAPP', 'pn-A');
      expect(accounts.findByChannel).toHaveBeenCalledWith('WHATSAPP', 'pn-B');
      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add.mock.calls[0][1]).toMatchObject({
        channelAccountId: 'acc-pn-A',
      });
      expect(queue.add.mock.calls[1][1]).toMatchObject({
        channelAccountId: 'acc-pn-B',
      });
    });

    it('firma inválida, ausente o sin cuerpo crudo: 401 y no encola', async () => {
      const p = payloadOf(change('pn-A', 'wamid.A'));
      const b = raw(p);
      await expect(
        svc.handlePlatformEvent(p, b, 'sha256=00'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(svc.handlePlatformEvent(p, b)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        svc.handlePlatformEvent(p, undefined, sign(b)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('sin META_APP_SECRET falla cerrado', async () => {
      delete process.env['META_APP_SECRET'];
      const p = payloadOf(change('pn-A', 'wamid.A'));
      const b = raw(p);
      await expect(
        svc.handlePlatformEvent(p, b, sign(b)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('un número desconocido o desconectado se ignora sin fallar el lote', async () => {
      accounts.findByChannel
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'acc-off', isActive: false })
        .mockResolvedValueOnce({ id: 'acc-ok', isActive: true });
      const p = payloadOf(
        change('pn-X', 'wamid.X'),
        change('pn-OFF', 'wamid.OFF'),
        change('pn-OK', 'wamid.OK'),
      );
      const b = raw(p);

      const res = await svc.handlePlatformEvent(p, b, sign(b));

      expect(res).toEqual({ status: 'ok' });
      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add.mock.calls[0][1]).toMatchObject({
        channelAccountId: 'acc-ok',
      });
    });

    it('un payload sin phone_number_id (p. ej. estados) se ignora', async () => {
      const p = {
        entry: [{ changes: [{ field: 'x', value: { statuses: [] } }] }],
      };
      const b = raw(p);
      await expect(svc.handlePlatformEvent(p, b, sign(b))).resolves.toEqual({
        status: 'ignored',
      });
      expect(accounts.findByChannel).not.toHaveBeenCalled();
    });
  });
});
