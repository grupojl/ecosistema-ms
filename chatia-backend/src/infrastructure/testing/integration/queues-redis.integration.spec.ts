// Integración con Postgres Y Redis REALES: mensaje entrante → cola → asistente → cola de salida → canal → estado en DB.
// Requiere TEST_DATABASE_URL y TEST_REDIS_URL (se saltea sola si falta alguna).
// Las colas usan un `prefix` propio de la corrida (bull:it-<run>): no toca colas ni claves de otros entornos,
// y al terminar se obliteran solo las colas de esta corrida.
import { Queue, Worker, type Job } from 'bullmq';
import {
  DbFixture,
  TEST_DATABASE_URL,
  type Tenant,
} from '@/infrastructure/testing/integration/db-fixture.js';
import { PrismaConversationsRepository } from '@/infrastructure/prisma/repositories/prisma-conversations.repository.js';
import { ConversationsService } from '@/core/conversations/conversations.service.js';
import { AutoReplyService } from '@/core/conversations/auto-reply.service.js';
import { IncomingMessageProcessor } from '@/infrastructure/queue/processors/incoming-message.processor.js';
import { AutoReplyProcessor } from '@/infrastructure/queue/processors/auto-reply.processor.js';
import { OutgoingMessageProcessor } from '@/infrastructure/queue/processors/outgoing-message.processor.js';
import { QUEUES, JOBS } from '@/infrastructure/queue/queue.constants.js';
import type { IncomingMessage } from '@/infrastructure/channels/channel.interface.js';

const TEST_REDIS_URL = process.env['TEST_REDIS_URL'];
const describeRedis =
  TEST_DATABASE_URL && TEST_REDIS_URL ? describe : describe.skip;

const waitFor = async (
  cond: () => Promise<boolean>,
  timeoutMs = 15_000,
): Promise<void> => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`waitFor: no se cumplió en ${timeoutMs} ms`);
};

describeRedis('colas con Redis + Postgres reales', () => {
  const fx = new DbFixture();
  const prefix = `it-${fx.run}`;
  const connection = { url: TEST_REDIS_URL as string };
  let a: Tenant;
  let b: Tenant;
  let accountA: string;
  let accountB: string;
  let repo: PrismaConversationsRepository;
  const queues: Queue[] = [];
  const workers: Worker[] = [];
  let inQ: Queue;
  let outQ: Queue;
  let replyQ: Queue;

  const sendMessage = jest.fn().mockResolvedValue(undefined);
  const chat = jest.fn();
  const emitMessageFailed = jest.fn();

  const incoming = (externalId: string, text: string): IncomingMessage => ({
    externalId,
    senderExternalId: `549-${fx.run}`,
    senderName: 'Ana',
    senderPhone: '549',
    type: 'text',
    content: text,
    timestamp: new Date(),
    raw: {},
  });

  const mkQueue = (name: string): Queue => {
    const q = new Queue(name, { connection, prefix });
    queues.push(q);
    return q;
  };
  const mkWorker = (
    name: string,
    fn: (job: Job) => Promise<unknown>,
    concurrency = 1,
  ): Worker => {
    const w = new Worker(name, fn, { connection, prefix, concurrency });
    workers.push(w);
    return w;
  };

  beforeAll(async () => {
    await fx.connect();
    a = await fx.tenant('qa');
    b = await fx.tenant('qb');
    repo = new PrismaConversationsRepository(fx.prisma);
    accountA = (
      await fx.prisma.channelAccount.create({
        data: {
          organizationId: a.organizationId,
          channelType: 'WHATSAPP',
          name: 'a',
          externalId: `phone-qa-${fx.run}`,
          accessToken: 'enc-a',
          projectId: a.projectId,
        },
      })
    ).id;
    accountB = (
      await fx.prisma.channelAccount.create({
        data: {
          organizationId: b.organizationId,
          channelType: 'WHATSAPP',
          name: 'b',
          externalId: `phone-qb-${fx.run}`,
          accessToken: 'enc-b',
        },
      })
    ).id;

    inQ = mkQueue(QUEUES.INCOMING_MESSAGE);
    outQ = mkQueue(QUEUES.OUTGOING_MESSAGE);
    replyQ = mkQueue(QUEUES.AUTO_REPLY);

    const conversations = new ConversationsService(
      repo,
      outQ,
      undefined,
      replyQ,
    );
    const autoReply = new AutoReplyService(
      repo,
      { chat } as never,
      {
        hit: jest.fn().mockResolvedValue({ allowed: true, count: 1, limit: 8 }),
      } as never,
      { emitEscalation: jest.fn() } as never,
      outQ,
    );
    const incomingProc = new IncomingMessageProcessor(
      conversations,
      {
        normalize: (m: IncomingMessage) => Promise.resolve({ text: m.content }),
      } as never,
      {
        resolve: () => Promise.resolve({ organizationId: '' }),
      } as never,
    );
    const replyProc = new AutoReplyProcessor(autoReply);
    const outgoingProc = new OutgoingMessageProcessor(
      { get: () => ({ sendMessage }) } as never,
      fx.prisma,
      { emitMessageFailed } as never,
      { decrypt: (t: string) => t } as never,
    );

    // concurrencia 10: fuerza la carrera real sobre la restricción única (conversationId, externalId)
    mkWorker(QUEUES.INCOMING_MESSAGE, (j) => incomingProc.process(j), 10);
    mkWorker(QUEUES.AUTO_REPLY, (j) => replyProc.process(j));
    // En la app, @nestjs/bullmq conecta @OnWorkerEvent('failed'); acá se hace a mano
    mkWorker(QUEUES.OUTGOING_MESSAGE, (j) => outgoingProc.process(j)).on(
      'failed',
      (job, err) => {
        if (job) void outgoingProc.onFailed(job, err);
      },
    );
    await Promise.all(workers.map((w) => w.waitUntilReady()));
  }, 60_000);

  afterAll(async () => {
    await Promise.all(workers.map((w) => w.close()));
    for (const q of queues) {
      await q.obliterate({ force: true });
      await q.close();
    }
    const orgs = [a.organizationId, b.organizationId];
    await fx.prisma.message.deleteMany({
      where: {
        conversation: { channelAccount: { organizationId: { in: orgs } } },
      },
    });
    await fx.prisma.conversation.deleteMany({
      where: { channelAccount: { organizationId: { in: orgs } } },
    });
    await fx.prisma.contact.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await fx.cleanup();
  }, 60_000);

  it('mensaje entrante → asistente → envío por el canal → mensaje SENT; el reenvío no duplica', async () => {
    chat.mockResolvedValue({ sessionId: 's1', response: 'De 8 a 16' });
    const ext = `wamid.q1-${fx.run}`;
    const data = {
      channelAccountId: accountA,
      channelType: 'WHATSAPP',
      msg: incoming(ext, 'cuál es el horario'),
    };

    await inQ.add(JOBS.PROCESS_MESSAGE, data, { jobId: `in_${ext}` });
    // Meta reenvía el webhook: segundo job distinto con el mismo externalId
    await inQ.add(JOBS.PROCESS_MESSAGE, data, { jobId: `in_${ext}_retry` });

    await waitFor(
      async () =>
        (await fx.prisma.message.count({
          where: {
            direction: 'OUTBOUND',
            status: 'SENT',
            conversation: {
              channelAccount: { organizationId: a.organizationId },
            },
          },
        })) === 1,
    );

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0]?.[0]).toMatchObject({
      type: 'text',
      content: 'De 8 a 16',
    });
    expect(chat).toHaveBeenCalledTimes(1);
    expect(
      await fx.prisma.message.count({
        where: {
          direction: 'INBOUND',
          conversation: {
            channelAccount: { organizationId: a.organizationId },
          },
        },
      }),
    ).toBe(1);
  }, 30_000);

  it('si el canal falla en todos los intentos, el mensaje queda FAILED y se avisa al front', async () => {
    sendMessage.mockReset().mockRejectedValue(new Error('meta 500'));
    const r = await repo.recordInboundMessage({
      channelAccountId: accountA,
      channelType: 'WHATSAPP',
      organizationId: a.organizationId,
      contact: { externalId: `549-f-${fx.run}`, name: 'Eva', phone: '549' },
      message: { content: 'hola', externalId: `wamid.f-${fx.run}` },
    });
    const out = await repo.createOutboundMessage(r.conversationId, 'respuesta');
    const outId = out.id;

    await outQ.add(
      JOBS.SEND_MESSAGE,
      {
        messageId: outId,
        conversationId: r.conversationId,
        organizationId: a.organizationId,
        channelType: 'WHATSAPP',
        recipientExternalId: '549',
        text: 'respuesta',
        accessToken: 'enc-a',
        externalId: `phone-qa-${fx.run}`,
        extraConfig: {},
        webhookVerifyToken: 'vt',
      },
      { attempts: 2, backoff: { type: 'fixed', delay: 100 } },
    );

    await waitFor(
      async () =>
        (await fx.prisma.message.findUnique({ where: { id: outId } }))
          ?.status === 'FAILED',
    );
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(emitMessageFailed).toHaveBeenCalledWith(
      a.organizationId,
      r.conversationId,
      outId,
    );
  }, 30_000);

  it('CARGA: 40 entregas concurrentes del MISMO mensaje (mismo y distinto jobId) → 1 entrante, 1 respuesta, 1 envío', async () => {
    sendMessage.mockReset().mockResolvedValue(undefined);
    chat
      .mockReset()
      .mockResolvedValue({ sessionId: 's2', response: 'una sola' });
    const ext = `wamid.dup-${fx.run}`;
    const sender = `549-dup-${fx.run}`;
    const data = {
      channelAccountId: accountA,
      channelType: 'WHATSAPP',
      msg: { ...incoming(ext, 'hola'), senderExternalId: sender },
    };
    await Promise.all([
      // mismo jobId: lo deduplica BullMQ
      ...Array.from({ length: 20 }, () =>
        inQ.add(JOBS.PROCESS_MESSAGE, data, { jobId: `in_${ext}` }),
      ),
      // jobId distinto, mismo externalId: lo deduplica la restricción única de la base
      ...Array.from({ length: 20 }, (_, i) =>
        inQ.add(JOBS.PROCESS_MESSAGE, data, { jobId: `in_${ext}_r${i}` }),
      ),
    ]);
    const outbound = () =>
      fx.prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          status: 'SENT',
          conversation: { contact: { externalId: sender } },
        },
      });
    await waitFor(async () => (await outbound()) === 1, 20_000);
    // margen para que cualquier duplicado tardío (reintentos con backoff) se manifieste
    await new Promise((r) => setTimeout(r, 3_000));

    expect(await outbound()).toBe(1);
    expect(
      await fx.prisma.message.count({
        where: {
          direction: 'INBOUND',
          conversation: { contact: { externalId: sender } },
        },
      }),
    ).toBe(1);
    expect(chat).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  }, 45_000);

  it('AISLAMIENTO: un job con organizationId de otro tenant no puede marcar el mensaje de A', async () => {
    sendMessage.mockReset().mockResolvedValue(undefined);
    const r = await repo.recordInboundMessage({
      channelAccountId: accountA,
      channelType: 'WHATSAPP',
      organizationId: a.organizationId,
      contact: { externalId: `549-i-${fx.run}`, name: 'Iris', phone: '549' },
      message: { content: 'hola', externalId: `wamid.i-${fx.run}` },
    });
    const out = await repo.createOutboundMessage(r.conversationId, 'x');
    const outId = out.id;

    const job = await outQ.add(JOBS.SEND_MESSAGE, {
      messageId: outId,
      conversationId: r.conversationId,
      organizationId: b.organizationId, // tenant equivocado
      channelType: 'WHATSAPP',
      recipientExternalId: '549',
      text: 'x',
      accessToken: 'enc-a',
      externalId: `phone-qa-${fx.run}`,
      extraConfig: {},
      webhookVerifyToken: 'vt',
    });
    await waitFor(async () => (await job.isCompleted()) as boolean);

    expect(
      (await fx.prisma.message.findUnique({ where: { id: outId } }))?.status,
    ).toBe('PENDING');
    void accountB;
  }, 30_000);
});
