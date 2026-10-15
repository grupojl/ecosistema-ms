// Complemento de webhooks.service.spec.ts: verificación GET del canal, rechazos uniformes, cola caída y casos de borde.
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import { WebhooksService } from '@/core/webhooks/webhooks.service.js';
import { WhatsAppChannel } from '@/infrastructure/channels/whatsapp/whatsapp.channel.js';

const SECRET = 'secreto-verify-spec';
const wa = (...ids: string[]) =>
  Buffer.from(
    JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                messages: ids.map((id) => ({
                  id,
                  from: '5491100000000',
                  type: 'text',
                  text: { body: 'hola' },
                  timestamp: '1700000000',
                })),
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

describe('WebhooksService — verificación, rechazos uniformes y borde', () => {
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
  const build = (q: unknown = queue) =>
    new WebhooksService(
      accounts as never,
      registry as never,
      q as never,
      TokenCipher.fromEnv({}),
    );

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['META_APP_SECRET'] = SECRET;
    accounts.findByChannel.mockResolvedValue(account);
    registry.get.mockReturnValue(new WhatsAppChannel());
    queue.add.mockResolvedValue(undefined);
  });
  afterEach(() => {
    delete process.env['META_APP_SECRET'];
    delete process.env['QUEUE_ADD_TIMEOUT_MS'];
  });

  describe('verify (GET de suscripción)', () => {
    const query = (token: string) => ({
      'hub.mode': 'subscribe',
      'hub.verify_token': token,
      'hub.challenge': 'CHALLENGE-9',
    });

    it('token correcto → devuelve el challenge', async () => {
      await expect(
        build().verify('WHATSAPP', 'pn-1', query('verify-ok')),
      ).resolves.toBe('CHALLENGE-9');
    });

    it('token incorrecto → 401', async () => {
      await expect(
        build().verify('WHATSAPP', 'pn-1', query('otro')),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('cuenta inexistente → 401 con el MISMO mensaje que un token inválido', async () => {
      accounts.findByChannel.mockResolvedValue(null);
      const unknown = await build()
        .verify('WHATSAPP', 'nope', query('verify-ok'))
        .catch((e: Error) => e);
      accounts.findByChannel.mockResolvedValue(account);
      const badToken = await build()
        .verify('WHATSAPP', 'pn-1', query('otro'))
        .catch((e: Error) => e);
      expect(unknown).toBeInstanceOf(UnauthorizedException);
      expect((unknown as Error).message).toBe((badToken as Error).message);
    });
  });

  describe('handleEvent', () => {
    it('todos los rechazos de autenticación responden igual (no se puede enumerar cuentas ni causas)', async () => {
      const body = wa('wamid.u');
      const causes: Array<() => Promise<unknown>> = [
        () => {
          accounts.findByChannel.mockResolvedValueOnce(null);
          return build().handleEvent('WHATSAPP', 'x', {}, body, sign(body));
        },
        () => build().handleEvent('WHATSAPP', 'pn-1', {}, body, undefined),
        () =>
          build().handleEvent('WHATSAPP', 'pn-1', {}, undefined, sign(body)),
        () =>
          build().handleEvent(
            'WHATSAPP',
            'pn-1',
            {},
            Buffer.alloc(0),
            sign(body),
          ),
        () => build().handleEvent('WHATSAPP', 'pn-1', {}, body, 'sha256=00'),
      ];
      const messages: string[] = [];
      for (const c of causes) {
        const err = await c().catch((e: Error) => e);
        expect(err).toBeInstanceOf(UnauthorizedException);
        messages.push((err as Error).message);
      }
      expect(new Set(messages).size).toBe(1);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('un canal sin verificación de firma se rechaza (fail closed)', async () => {
      registry.get.mockReturnValue({
        parseIncomingWebhook: jest.fn(),
        verifySignature: undefined,
      });
      const body = wa('wamid.n');
      await expect(
        build().handleEvent('WHATSAPP', 'pn-1', {}, body, sign(body)),
      ).rejects.toThrow(UnauthorizedException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('firma válida pero sin mensajes (ej. status de entrega) → "ignored" y no encola', async () => {
      const body = Buffer.from(
        JSON.stringify({ entry: [{ changes: [{ value: { statuses: [] } }] }] }),
      );
      await expect(
        build().handleEvent(
          'WHATSAPP',
          'pn-1',
          JSON.parse(body.toString()),
          body,
          sign(body),
        ),
      ).resolves.toEqual({ status: 'ignored' });
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('con la cola deshabilitada (REDIS_ENABLED=false) responde ok-noop sin romper', async () => {
      const body = wa('wamid.q');
      await expect(
        build(null).handleEvent(
          'WHATSAPP',
          'pn-1',
          JSON.parse(body.toString()),
          body,
          sign(body),
        ),
      ).resolves.toEqual({ status: 'ok-noop' });
    });

    it('un jobId nunca lleva ":" aunque el id externo lo tenga (BullMQ lo rechazaría)', async () => {
      const body = wa('mid:con:dos:puntos');
      await build().handleEvent(
        'WHATSAPP',
        'pn-1',
        JSON.parse(body.toString()),
        body,
        sign(body),
      );
      const opts = queue.add.mock.calls[0]?.[2] as { jobId: string };
      expect(opts.jobId).toBe('msg_acc-1_mid_con_dos_puntos');
      expect(opts.jobId).not.toContain(':');
    });

    it('varios mensajes en un mismo webhook → un job por mensaje', async () => {
      const body = wa('wamid.a', 'wamid.b', 'wamid.c');
      await expect(
        build().handleEvent(
          'WHATSAPP',
          'pn-1',
          JSON.parse(body.toString()),
          body,
          sign(body),
        ),
      ).resolves.toEqual({ status: 'ok' });
      expect(queue.add).toHaveBeenCalledTimes(3);
    });

    it('con la cola colgada (Redis caído) responde 503 rápido para que Meta reintente', async () => {
      process.env['QUEUE_ADD_TIMEOUT_MS'] = '50';
      queue.add.mockReturnValue(new Promise(() => undefined));
      const body = wa('wamid.hang');
      const t0 = Date.now();
      await expect(
        build().handleEvent(
          'WHATSAPP',
          'pn-1',
          JSON.parse(body.toString()),
          body,
          sign(body),
        ),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(Date.now() - t0).toBeLessThan(1_000);
    });
  });
});
