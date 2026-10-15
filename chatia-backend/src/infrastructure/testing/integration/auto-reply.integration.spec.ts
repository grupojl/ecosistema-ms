// Integración con Postgres real: circuito de respuesta automática (entrada idempotente → contexto → salida).
// Lo que los mocks no ven: SQL real, la restricción única (conversationId, externalId) y el filtro JSON por metadata.replyTo.
import {
  DbFixture,
  describeDb,
  type Tenant,
} from '@/infrastructure/testing/integration/db-fixture.js';
import { PrismaConversationsRepository } from '@/infrastructure/prisma/repositories/prisma-conversations.repository.js';
import { AutoReplyService } from '@/core/conversations/auto-reply.service.js';

describeDb('auto-reply — circuito completo (Postgres real)', () => {
  const fx = new DbFixture();
  let a: Tenant;
  let b: Tenant;
  let repo: PrismaConversationsRepository;
  let accountA: string;
  let accountB: string;

  const inbound = (
    tenant: Tenant,
    account: string,
    id: string,
    text = 'hola',
  ) =>
    repo.recordInboundMessage({
      channelAccountId: account,
      channelType: 'WHATSAPP',
      organizationId: tenant.organizationId,
      contact: { externalId: `549-${fx.run}`, name: 'Ana', phone: '549' },
      message: { content: text, externalId: id },
    });

  beforeAll(async () => {
    await fx.connect();
    a = await fx.tenant('ra');
    b = await fx.tenant('rb');
    repo = new PrismaConversationsRepository(fx.prisma);
    accountA = (
      await fx.prisma.channelAccount.create({
        data: {
          organizationId: a.organizationId,
          channelType: 'WHATSAPP',
          name: 'a',
          externalId: `phone-a-${fx.run}`,
          accessToken: 'enc-token-a',
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
          externalId: `phone-b-${fx.run}`,
          accessToken: 'enc-token-b',
        },
      })
    ).id;
  }, 30_000);

  afterAll(async () => {
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
    await fx.prisma.aiConfig.deleteMany({
      where: { channelAccountId: { in: [accountA, accountB] } },
    });
    await fx.cleanup();
  }, 30_000);

  it('un webhook reenviado por Meta no duplica el mensaje y se marca como duplicado', async () => {
    const first = await inbound(a, accountA, `wamid.dup-${fx.run}`);
    const second = await inbound(a, accountA, `wamid.dup-${fx.run}`);

    expect(first.duplicate).toBe(false);
    expect(first.conversationCreated).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.messageId).toBe(first.messageId);
    expect(second.conversationCreated).toBe(false);
    expect(
      await fx.prisma.message.count({
        where: { conversationId: first.conversationId, direction: 'INBOUND' },
      }),
    ).toBe(1);
  });

  it('getAutoReplyContext trae canal, proyecto y ecosistema correctos; sin proyecto → null', async () => {
    const r = await inbound(a, accountA, `wamid.ctx-${fx.run}`, 'horario?');
    const ctx = await repo.getAutoReplyContext(r.conversationId, r.messageId);

    expect(ctx).toMatchObject({
      organizationId: a.organizationId,
      ecosystemId: a.ecosystemId,
      channelType: 'WHATSAPP',
      externalId: `phone-a-${fx.run}`,
      accessToken: 'enc-token-a',
      projectSlug: a.projectSlug,
      inboundText: 'horario?',
      status: 'OPEN',
      isAiActive: true,
      aiEnabled: true,
      alreadyReplied: false,
    });
    expect(ctx?.webhookVerifyToken).toBeTruthy();

    const rb = await inbound(b, accountB, `wamid.ctxb-${fx.run}`);
    const ctxB = await repo.getAutoReplyContext(
      rb.conversationId,
      rb.messageId,
    );
    expect(ctxB?.projectSlug).toBeNull();
    expect(ctxB?.organizationId).toBe(b.organizationId);
  });

  it('no mezcla mensajes: un messageId de otra conversación devuelve null', async () => {
    const ra = await inbound(a, accountA, `wamid.x1-${fx.run}`);
    const rb = await inbound(b, accountB, `wamid.x2-${fx.run}`);
    expect(
      await repo.getAutoReplyContext(ra.conversationId, rb.messageId),
    ).toBeNull();
  });

  it('alreadyReplied pasa a true recién cuando existe la respuesta de IA ligada a ESE mensaje', async () => {
    const r1 = await inbound(a, accountA, `wamid.rp1-${fx.run}`);
    const r2 = await inbound(a, accountA, `wamid.rp2-${fx.run}`);
    expect(r1.conversationId).toBe(r2.conversationId);

    await repo.createOutboundMessage(r1.conversationId, 'respuesta', {
      isAiGenerated: true,
      replyTo: r1.messageId,
    });
    // una respuesta MANUAL no cuenta como respuesta de la IA
    await repo.createOutboundMessage(r1.conversationId, 'manual');

    expect(
      (await repo.getAutoReplyContext(r1.conversationId, r1.messageId))
        ?.alreadyReplied,
    ).toBe(true);
    expect(
      (await repo.getAutoReplyContext(r2.conversationId, r2.messageId))
        ?.alreadyReplied,
    ).toBe(false);
  });

  it('AiConfig.isEnabled=false y humanTakeoverKeywords llegan al contexto', async () => {
    await fx.prisma.aiConfig.create({
      data: {
        channelAccountId: accountB,
        systemPrompt: 'x',
        personaName: 'p',
        isEnabled: false,
        humanTakeoverKeywords: ['humano'],
      },
    });
    const r = await inbound(b, accountB, `wamid.cfg-${fx.run}`);
    const ctx = await repo.getAutoReplyContext(r.conversationId, r.messageId);
    expect(ctx?.aiEnabled).toBe(false);
    expect(ctx?.takeoverKeywords).toEqual(['humano']);
  });

  it('getOutboundContext devuelve externalId y token del canal (antes faltaban en el envío manual)', async () => {
    const r = await inbound(a, accountA, `wamid.out-${fx.run}`);
    expect(
      await repo.getOutboundContext(r.conversationId, a.organizationId),
    ).toMatchObject({
      externalId: `phone-a-${fx.run}`,
      accessToken: 'enc-token-a',
    });
    // otra organización no puede obtener el contexto
    expect(
      await repo.getOutboundContext(r.conversationId, b.organizationId),
    ).toBeNull();
  });

  it('AutoReplyService de punta a punta contra la base: responde una sola vez por mensaje', async () => {
    const r = await inbound(
      a,
      accountA,
      `wamid.e2e-${fx.run}`,
      'cuál es el horario',
    );
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const chat = {
      chat: jest
        .fn()
        .mockResolvedValue({ sessionId: 's1', response: 'De 8 a 16' }),
    };
    const svc = new AutoReplyService(
      repo,
      chat as never,
      {
        hit: jest.fn().mockResolvedValue({ allowed: true, count: 1, limit: 8 }),
      } as never,
      { emitEscalation: jest.fn() } as never,
      queue as never,
    );
    const job = {
      conversationId: r.conversationId,
      inboundMessageId: r.messageId,
    };

    expect((await svc.reply(job)).status).toBe('replied');
    // reintento del job (BullMQ): no responde de nuevo
    expect(await svc.reply(job)).toEqual({
      status: 'skipped',
      reason: 'already_replied',
    });

    expect(chat.chat).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledTimes(1);
    const sent = (
      queue.add.mock.calls[0] as [string, Record<string, unknown>]
    )[1];
    expect(sent).toMatchObject({
      text: 'De 8 a 16',
      externalId: `phone-a-${fx.run}`,
      organizationId: a.organizationId,
    });
    const msg = await fx.prisma.message.findUnique({
      where: { id: sent['messageId'] as string },
    });
    expect(msg).toMatchObject({
      isAiGenerated: true,
      direction: 'OUTBOUND',
      status: 'PENDING',
    });
  });

  it('handoff real: el pedido explícito pasa la conversación a HUMAN_TAKEOVER en la base', async () => {
    await fx.prisma.aiConfig.update({
      where: { channelAccountId: accountB },
      data: { isEnabled: true },
    });
    const r = await inbound(
      b,
      accountB,
      `wamid.ho-${fx.run}`,
      'quiero hablar con un humano',
    );
    const emit = jest.fn();
    const svc = new AutoReplyService(
      repo,
      { chat: jest.fn() } as never,
      {
        hit: jest.fn().mockResolvedValue({ allowed: true, count: 1, limit: 8 }),
      } as never,
      { emitEscalation: emit } as never,
      { add: jest.fn() } as never,
    );

    const out = await svc.reply({
      conversationId: r.conversationId,
      inboundMessageId: r.messageId,
    });

    expect(out.status).toBe('handoff');
    expect(emit).toHaveBeenCalledWith(b.organizationId, r.conversationId);
    expect(
      await fx.prisma.conversation.findUnique({
        where: { id: r.conversationId },
        select: { status: true, isAiActive: true },
      }),
    ).toEqual({ status: 'HUMAN_TAKEOVER', isAiActive: false });
  });
});
