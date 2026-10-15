// Pruebas de ataque por HTTP contra las dos superficies PÚBLICAS: webhooks de canales y widget.
// Usa los controllers y services reales (Nest + express + rawBody) sobre Postgres real: lo que un atacante ve desde afuera.
// Requiere TEST_DATABASE_URL (se saltea sola si falta). El LLM y la cola son dobles: acá se prueba que NO se llega a ellos.
import { createHmac } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  DbFixture,
  describeDb,
  type Tenant,
} from '@/infrastructure/testing/integration/db-fixture.js';
import { WebhooksController } from '@/modules/common/webhooks/webhooks.controller.js';
import { WidgetController } from '@/modules/common/widget/widget.controller.js';
import { WebhooksService } from '@/core/webhooks/webhooks.service.js';
import { WidgetConfigService } from '@/core/widget/widget-config.service.js';
import { WidgetSessionService } from '@/core/widget/widget-session.service.js';
import { AssistantChatService } from '@/core/assistant/chat/assistant-chat.service.js';
import { AssistantSessionService } from '@/core/assistant/session/assistant-session.service.js';
import { RateLimitService } from '@/infrastructure/security/rate-limit.service.js';
import { PrismaChannelAccountsRepository } from '@/infrastructure/prisma/repositories/prisma-channel-accounts.repository.js';
import { PrismaProjectsRepository } from '@/infrastructure/prisma/repositories/prisma-projects.repository.js';
import { WhatsAppChannel } from '@/infrastructure/channels/whatsapp/whatsapp.channel.js';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';

const META_SECRET = 'meta-secret-ataque';
const SECRET_B = 'secret-propio-de-b';

const waBody = (id: string): Buffer =>
  Buffer.from(
    JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id,
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
const sign = (buf: Buffer, secret: string): string =>
  `sha256=${createHmac('sha256', secret).update(buf).digest('hex')}`;

describeDb('superficie pública — ataques por HTTP (Postgres real)', () => {
  const fx = new DbFixture();
  let app: INestApplication;
  let a: Tenant;
  let b: Tenant;
  let extA: string;
  let extB: string;
  let ipSeq = 0;
  const queue = { add: jest.fn() };
  const chat = jest.fn();
  const findByUser = jest.fn();
  const server = () => app.getHttpServer() as Parameters<typeof request>[0];
  /** IP distinta por prueba: los contadores de rate limit son por IP y no se pisan entre pruebas. */
  const ip = (): string => `10.9.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;

  beforeAll(async () => {
    process.env['META_APP_SECRET'] = META_SECRET;
    process.env['WIDGET_SESSION_SECRET'] = 'w'.repeat(40);
    await fx.connect();
    a = await fx.tenant('xa');
    b = await fx.tenant('xb');
    extA = `x-a-${fx.run}`;
    extB = `x-b-${fx.run}`;
    await fx.prisma.channelAccount.create({
      data: {
        organizationId: a.organizationId,
        channelType: 'WHATSAPP',
        name: 'a',
        externalId: extA,
        accessToken: 't',
        webhookVerifyToken: 'verify-a',
      },
    });
    await fx.prisma.channelAccount.create({
      data: {
        organizationId: b.organizationId,
        channelType: 'WHATSAPP',
        name: 'b',
        externalId: extB,
        accessToken: 't',
        webhookVerifyToken: 'verify-b',
        extraConfig: { appSecret: SECRET_B },
      },
    });
    for (const [t, origins] of [
      [a, []],
      [b, ['https://b.example']],
    ] as const) {
      await fx.prisma.assistantConfig.create({
        data: {
          projectId: t.projectId,
          organizationId: t.organizationId,
          personaName: 'Ana',
          systemPrompt: 'SECRETO-DE-PROMPT',
          allowedOrigins: [...origins],
          welcomeMessage: 'hola',
        },
      });
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [WebhooksController, WidgetController],
      providers: [
        {
          provide: WebhooksService,
          useValue: new WebhooksService(
            new PrismaChannelAccountsRepository(fx.prisma),
            { get: () => new WhatsAppChannel() } as never,
            queue as never,
            TokenCipher.fromEnv({}),
          ),
        },
        {
          provide: WidgetConfigService,
          useValue: new WidgetConfigService(
            new PrismaProjectsRepository(fx.prisma),
          ),
        },
        { provide: WidgetSessionService, useValue: new WidgetSessionService() },
        { provide: RateLimitService, useValue: new RateLimitService() },
        { provide: AssistantChatService, useValue: { chat } },
        { provide: AssistantSessionService, useValue: { findByUser } },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    (
      app.getHttpAdapter().getInstance() as {
        set: (k: string, v: unknown) => void;
      }
    ).set('trust proxy', true);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await fx.prisma.assistantConfig.deleteMany({
      where: { organizationId: { in: [a.organizationId, b.organizationId] } },
    });
    await fx.cleanup();
    delete process.env['META_APP_SECRET'];
    delete process.env['WIDGET_CHAT_PER_MIN_SESSION'];
    delete process.env['WIDGET_SESSIONS_PER_MIN_IP'];
  }, 60_000);

  beforeEach(() => {
    queue.add.mockClear();
    chat.mockReset().mockResolvedValue({ sessionId: 's', response: 'ok' });
    findByUser.mockReset().mockResolvedValue(null);
  });

  // ─────────────────────────── WEBHOOKS ───────────────────────────
  describe('webhooks', () => {
    const post = (ext: string, buf: Buffer, sig?: string | string[]) => {
      const r = request(server())
        .post(`/api/v1/webhooks/whatsapp/${ext}`)
        .set('Content-Type', 'application/json');
      if (sig !== undefined) r.set('x-hub-signature-256', sig as string);
      // string, no Buffer: superagent serializa un Buffer como JSON y la firma ya no coincidiría con el cuerpo
      return r.send(buf.toString('utf8'));
    };

    it('firma válida → 200 y encola una vez', async () => {
      const buf = waBody('wamid.ok');
      await post(extA, buf, sign(buf, META_SECRET)).expect(200);
      expect(queue.add).toHaveBeenCalledTimes(1);
    });

    it('sin firma → 401 y no encola', async () => {
      await post(extA, waBody('wamid.x1')).expect(401);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('cuerpo alterado después de firmar → 401', async () => {
      const buf = waBody('wamid.x2');
      const tampered = Buffer.from(buf.toString().replace('hola', 'chau'));
      await post(extA, tampered, sign(buf, META_SECRET)).expect(401);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it.each([
      ['vacía', ''],
      ['sin prefijo sha256=', 'abcd'],
      ['hex inválido', 'sha256=zzzz'],
      ['longitud incorrecta', 'sha256=abcd'],
      ['solo el prefijo', 'sha256='],
      ['64 ceros', `sha256=${'0'.repeat(64)}`],
    ])('firma malformada (%s) → 401, nunca 500', async (_n, sig) => {
      const res = await post(extA, waBody('wamid.m'), sig);
      expect([401]).toContain(res.status);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('firma hecha con otro secreto → 401', async () => {
      const buf = waBody('wamid.x3');
      await post(extA, buf, sign(buf, 'otro-secreto')).expect(401);
    });

    it('AISLAMIENTO: el secreto propio de B no firma webhooks de A, ni el de Meta los de B', async () => {
      const buf = waBody('wamid.x4');
      await post(extA, buf, sign(buf, SECRET_B)).expect(401);
      await post(extB, buf, sign(buf, META_SECRET)).expect(401);
      await post(extB, buf, sign(buf, SECRET_B)).expect(200);
      expect(queue.add).toHaveBeenCalledTimes(1);
      expect((queue.add.mock.calls[0] as unknown[])[1]).toMatchObject({
        channelType: 'WHATSAPP',
      });
    });

    it('cuenta inexistente y firma inválida dan la MISMA respuesta (no se enumeran cuentas)', async () => {
      const buf = waBody('wamid.x5');
      const unknown = await post(`nope-${fx.run}`, buf, sign(buf, META_SECRET));
      const badSig = await post(extA, buf, 'sha256=00');
      expect(unknown.status).toBe(401);
      expect(badSig.status).toBe(401);
      expect(unknown.body).toEqual(badSig.body);
    });

    it('reenvío del mismo webhook firmado (replay) → mismo jobId: BullMQ lo deduplica', async () => {
      const buf = waBody('wamid.replay');
      await post(extA, buf, sign(buf, META_SECRET)).expect(200);
      await post(extA, buf, sign(buf, META_SECRET)).expect(200);
      const ids = queue.add.mock.calls.map(
        (c) => (c as [string, unknown, { jobId: string }])[2].jobId,
      );
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe(ids[1]);
      expect(ids[0]).not.toContain(':');
    });

    it('inyecciones en la ruta (SQL, traversal, caracteres raros) → 401/404, nunca 500', async () => {
      const buf = waBody('wamid.inj');
      for (const ext of [
        "' OR '1'='1",
        '1; DROP TABLE "ChannelAccount";--',
        '..%2f..%2fetc%2fpasswd',
        '%00',
        'a'.repeat(5000),
      ]) {
        const res = await post(
          encodeURIComponent(ext),
          buf,
          sign(buf, META_SECRET),
        );
        expect([400, 401, 404]).toContain(res.status);
      }
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('canal desconocido → 404', async () => {
      await request(server())
        .post(`/api/v1/webhooks/telegrm/${extA}`)
        .send({})
        .expect(404);
    });

    it('cuerpo enorme → 413 y no se procesa', async () => {
      const big = Buffer.from(JSON.stringify({ x: 'a'.repeat(2_000_000) }));
      const res = await post(extA, big, sign(big, META_SECRET));
      expect(res.status).toBe(413);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('JSON con __proto__ / constructor no rompe ni contamina el prototipo', async () => {
      const buf = Buffer.from(
        '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"entry":[]}',
      );
      const res = await post(extA, buf, sign(buf, META_SECRET));
      expect(res.status).toBeLessThan(500);
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });

    it('GET de verificación: token incorrecto → 401; correcto → devuelve el challenge', async () => {
      const q = (token: string) =>
        request(server()).get(`/api/v1/webhooks/whatsapp/${extA}`).query({
          'hub.mode': 'subscribe',
          'hub.verify_token': token,
          'hub.challenge': 'CHALLENGE-123',
        });
      await q('incorrecto').expect(401);
      await q('verify-b').expect(401); // el token de B no sirve en A
      const ok = await q('verify-a').expect(200);
      expect(ok.text).toBe('CHALLENGE-123');
    });
  });

  // ──────────────────────────── WIDGET ────────────────────────────
  describe('widget', () => {
    const base = (slug: string) => `/api/v1/widget/${slug}`;
    const session = (
      slug: string,
      org: string,
      from: string,
      origin?: string,
    ) => {
      const r = request(server())
        .post(`${base(slug)}/session`)
        .query({ org })
        .set('X-Forwarded-For', from);
      if (origin) r.set('Origin', origin);
      return r;
    };
    const chatReq = (
      slug: string,
      org: string,
      token: string | undefined,
      body: unknown,
      from: string,
      origin?: string,
    ) => {
      const r = request(server())
        .post(`${base(slug)}/chat`)
        .query({ org })
        .set('X-Forwarded-For', from);
      if (token) r.set('x-widget-token', token);
      if (origin) r.set('Origin', origin);
      return r.send(body as object);
    };
    const tokenFor = async (t: Tenant, from: string, origin?: string) =>
      (
        (await session(t.projectSlug, t.organizationId, from, origin)).body as {
          token: string;
        }
      ).token;

    it('la config pública no filtra el systemPrompt ni datos internos', async () => {
      const res = await request(server())
        .get(`${base(a.projectSlug)}/config`)
        .query({ org: a.organizationId })
        .set('X-Forwarded-For', ip())
        .expect(200);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('SECRETO-DE-PROMPT');
      expect(Object.keys(res.body as object).sort()).toEqual([
        'isEnabled',
        'personaName',
        'welcomeMessage',
      ]);
    });

    it('chat sin token, con basura o con firma alterada → 401 y NO se llama al LLM', async () => {
      const from = ip();
      const good = await tokenFor(a, from);
      const [v, body, sig] = good.split('.');
      const forged = [
        undefined,
        '',
        'basura',
        `${v}.${body}.${'0'.repeat((sig ?? '').length)}`,
        `${v}.${Buffer.from('{"sid":"otro"}').toString('base64url')}.${sig}`,
      ];
      for (const tk of forged) {
        await chatReq(
          a.projectSlug,
          a.organizationId,
          tk,
          { message: 'hola' },
          from,
        ).expect(401);
      }
      expect(chat).not.toHaveBeenCalled();
    });

    it('AISLAMIENTO: el token de A no sirve para B (ni cambiando ?org= ni el slug)', async () => {
      const from = ip();
      const tokenA = await tokenFor(a, from);
      await chatReq(
        b.projectSlug,
        b.organizationId,
        tokenA,
        { message: 'x' },
        from,
        'https://b.example',
      ).expect(401);
      await chatReq(
        a.projectSlug,
        b.organizationId,
        tokenA,
        { message: 'x' },
        from,
      ).expect(404);
      expect(chat).not.toHaveBeenCalled();
    });

    it('el userId que llega al asistente sale del token, no de lo que manda el cliente', async () => {
      const from = ip();
      const tk = await tokenFor(a, from);
      await chatReq(
        a.projectSlug,
        a.organizationId,
        tk,
        { message: 'hola', userId: 'admin', organizationId: b.organizationId },
        from,
      ).expect(200);
      const arg = chat.mock.calls[0]?.[0] as Record<string, string>;
      expect(arg['userId']).toMatch(/^widget:/);
      expect(arg['organizationId']).toBe(a.organizationId);
    });

    it('cuerpo inválido: vacío, tipo incorrecto, demasiado largo → 400 sin llamar al LLM', async () => {
      const from = ip();
      const tk = await tokenFor(a, from);
      for (const body of [
        {},
        { message: '' },
        { message: '   ' },
        { message: 123 },
        { message: { $ne: null } },
        { message: 'a'.repeat(2001) },
      ]) {
        await chatReq(a.projectSlug, a.organizationId, tk, body, from).expect(
          400,
        );
      }
      expect(chat).not.toHaveBeenCalled();
    });

    it('cuerpo enorme → 413', async () => {
      const from = ip();
      const tk = await tokenFor(a, from);
      const res = await chatReq(
        a.projectSlug,
        a.organizationId,
        tk,
        { message: 'a'.repeat(2_000_000) },
        from,
      );
      expect(res.status).toBe(413);
    });

    it('slug hostil (SQL, XSS, traversal) → 404, nunca 500 ni eco sin escapar', async () => {
      for (const slug of [
        "x' OR '1'='1",
        '<script>alert(1)</script>',
        '..%2f..%2fetc%2fpasswd',
        'a'.repeat(3000),
      ]) {
        const res = await request(server())
          .get(`${base(encodeURIComponent(slug))}/config`)
          .set('X-Forwarded-For', ip());
        expect([400, 404]).toContain(res.status);
        expect(res.text).not.toContain('<script>');
      }
    });

    it('origen no permitido → 403 en sesión, chat e historial; sin cabecera Origin también', async () => {
      const from = ip();
      await session(
        b.projectSlug,
        b.organizationId,
        from,
        'https://evil.example',
      ).expect(403);
      await session(b.projectSlug, b.organizationId, from).expect(403);
      const tk = await tokenFor(b, from, 'https://b.example');
      await chatReq(
        b.projectSlug,
        b.organizationId,
        tk,
        { message: 'x' },
        from,
        'https://evil.example',
      ).expect(403);
      await request(server())
        .get(`${base(b.projectSlug)}/session`)
        .query({ org: b.organizationId })
        .set('X-Forwarded-For', from)
        .set('x-widget-token', tk)
        .set('Origin', 'https://evil.example')
        .expect(403);
      expect(chat).not.toHaveBeenCalled();
    });

    it('el historial solo se pide con el token propio y se busca por la sesión del token', async () => {
      const from = ip();
      await request(server())
        .get(`${base(a.projectSlug)}/session`)
        .query({ org: a.organizationId })
        .set('X-Forwarded-For', from)
        .expect(401);
      const tk = await tokenFor(a, from);
      await request(server())
        .get(`${base(a.projectSlug)}/session`)
        .query({ org: a.organizationId, userId: 'widget:ajeno' })
        .set('X-Forwarded-For', from)
        .set('x-widget-token', tk)
        .expect(200);
      expect(findByUser.mock.calls[0]?.[1]).toBe(a.organizationId);
      expect(findByUser.mock.calls[0]?.[2]).not.toBe('widget:ajeno');
    });

    it('límite por sesión: el mensaje N+1 → 429 con Retry-After y sin gastar LLM', async () => {
      process.env['WIDGET_CHAT_PER_MIN_SESSION'] = '3';
      const from = ip();
      const tk = await tokenFor(a, from);
      for (let i = 0; i < 3; i++) {
        await chatReq(
          a.projectSlug,
          a.organizationId,
          tk,
          { message: `m${i}` },
          from,
        ).expect(200);
      }
      const blocked = await chatReq(
        a.projectSlug,
        a.organizationId,
        tk,
        { message: 'm4' },
        from,
      );
      expect(blocked.status).toBe(429);
      expect(chat).toHaveBeenCalledTimes(3);
      delete process.env['WIDGET_CHAT_PER_MIN_SESSION'];
    });

    it('inundación de sesiones desde una IP → 429', async () => {
      process.env['WIDGET_SESSIONS_PER_MIN_IP'] = '3';
      const from = ip();
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) {
        codes.push(
          (await session(a.projectSlug, a.organizationId, from)).status,
        );
      }
      expect(codes.slice(0, 3)).toEqual([201, 201, 201]);
      expect(codes.slice(3)).toEqual([429, 429]);
      delete process.env['WIDGET_SESSIONS_PER_MIN_IP'];
    });

    it('slug repetido en dos organizaciones sin ?org= → 409 (no mezcla tenants)', async () => {
      const dup = await fx.prisma.project.create({
        data: {
          id: `${a.projectId}_dup`,
          organizationId: b.organizationId,
          slug: a.projectSlug,
          name: 'dup',
        },
      });
      await fx.prisma.assistantConfig.create({
        data: { projectId: dup.id, organizationId: b.organizationId },
      });
      try {
        await request(server())
          .get(`${base(a.projectSlug)}/config`)
          .set('X-Forwarded-For', ip())
          .expect(409);
      } finally {
        await fx.prisma.assistantConfig.deleteMany({
          where: { projectId: dup.id },
        });
        await fx.prisma.project.delete({ where: { id: dup.id } });
      }
    });
  });
});
