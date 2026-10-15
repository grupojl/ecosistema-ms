import { NotFoundException } from '@nestjs/common';
import {
  AutoReplyService,
  type AutoReplyJobData,
} from '@/core/conversations/auto-reply.service.js';
import type { AutoReplyContext } from '@/core/conversations/repository/conversations.repository.interface.js';

const JOB: AutoReplyJobData = { conversationId: 'c1', inboundMessageId: 'm1' };

const baseCtx = (over: Partial<AutoReplyContext> = {}): AutoReplyContext => ({
  conversationId: 'c1',
  organizationId: 'org1',
  ecosystemId: 'eco1',
  channelAccountId: 'ca1',
  channelType: 'WHATSAPP',
  externalId: 'phone-id',
  accessToken: 'tok',
  extraConfig: {},
  webhookVerifyToken: 'vt',
  recipientExternalId: '5491100000000',
  status: 'OPEN',
  isAiActive: true,
  assignedAgentId: null,
  projectSlug: 'proj',
  aiEnabled: true,
  takeoverKeywords: ['humano', 'persona'],
  inboundText: 'hola, ¿horario de atención?',
  alreadyReplied: false,
  ...over,
});

function build(ctx: AutoReplyContext | null) {
  const repo = {
    getAutoReplyContext: jest.fn().mockResolvedValue(ctx),
    createOutboundMessage: jest.fn().mockResolvedValue({ id: 'out1' }),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    updateAiActive: jest.fn().mockResolvedValue(undefined),
  };
  const chat = {
    chat: jest
      .fn()
      .mockResolvedValue({ sessionId: 's1', response: 'Respuesta' }),
  };
  const rateLimit = {
    hit: jest.fn().mockResolvedValue({ allowed: true, count: 1, limit: 8 }),
  };
  const events = { emitEscalation: jest.fn() };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const svc = new AutoReplyService(
    repo as never,
    chat as never,
    rateLimit as never,
    events as never,
    queue as never,
  );
  return { svc, repo, chat, rateLimit, events, queue };
}

describe('AutoReplyService', () => {
  it('responde y encola el mensaje saliente con externalId y token del canal', async () => {
    const { svc, repo, queue, chat } = build(baseCtx());

    const out = await svc.reply(JOB);

    expect(out).toEqual({ status: 'replied', messageId: 'out1' });
    expect(chat.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        ecosystemId: 'eco1',
        userId: 'WHATSAPP:5491100000000',
        channel: 'whatsapp',
      }),
    );
    expect(repo.createOutboundMessage).toHaveBeenCalledWith('c1', 'Respuesta', {
      isAiGenerated: true,
      replyTo: 'm1',
    });
    const [, data, opts] = queue.add.mock.calls[0] as [
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(data).toMatchObject({
      messageId: 'out1',
      externalId: 'phone-id',
      webhookVerifyToken: 'vt',
      accessToken: 'tok',
      text: 'Respuesta',
    });
    expect(opts['jobId']).toBe('send_out1');
  });

  it.each([
    ['not_found', null],
    ['not_open', baseCtx({ status: 'RESOLVED' })],
    ['human_active', baseCtx({ assignedAgentId: 'agent1' })],
    ['human_active', baseCtx({ isAiActive: false })],
    ['ai_disabled', baseCtx({ aiEnabled: false })],
    ['already_replied', baseCtx({ alreadyReplied: true })],
    ['empty_message', baseCtx({ inboundText: '   ' })],
  ])('omite con motivo %s', async (reason, ctx) => {
    const { svc, chat, queue } = build(ctx);

    const out = await svc.reply(JOB);

    expect(out).toEqual({ status: 'skipped', reason });
    expect(chat.chat).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('omite si se supera el tope por minuto', async () => {
    const { svc, rateLimit, chat } = build(baseCtx());
    rateLimit.hit.mockResolvedValue({ allowed: false, count: 9, limit: 8 });

    expect(await svc.reply(JOB)).toEqual({
      status: 'skipped',
      reason: 'rate_limited',
    });
    expect(chat.chat).not.toHaveBeenCalled();
  });

  it('pasa a atención humana solo si el ciudadano lo pide', async () => {
    const { svc, repo, events, chat, queue } = build(
      baseCtx({ inboundText: 'quiero hablar con una PERSONA' }),
    );

    const out = await svc.reply(JOB);

    expect(out.status).toBe('handoff');
    expect(repo.updateStatus).toHaveBeenCalledWith(
      'c1',
      'org1',
      'HUMAN_TAKEOVER',
    );
    expect(repo.updateAiActive).toHaveBeenCalledWith('c1', 'org1', false);
    expect(events.emitEscalation).toHaveBeenCalledWith('org1', 'c1');
    expect(chat.chat).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('ignora palabras clave vacías', async () => {
    const { svc } = build(baseCtx({ takeoverKeywords: ['', '  '] }));
    expect((await svc.reply(JOB)).status).toBe('replied');
  });

  it('NotFoundException del asistente → not_configured (no reintenta)', async () => {
    const { svc, chat, queue } = build(baseCtx());
    chat.chat.mockRejectedValue(new NotFoundException());

    expect(await svc.reply(JOB)).toEqual({
      status: 'skipped',
      reason: 'not_configured',
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('sessionId vacío (asistente apagado) → not_configured', async () => {
    const { svc, chat } = build(baseCtx());
    chat.chat.mockResolvedValue({ sessionId: '', response: '' });

    expect(await svc.reply(JOB)).toEqual({
      status: 'skipped',
      reason: 'not_configured',
    });
  });

  it('un error real se relanza para que BullMQ reintente y no escala a humano', async () => {
    const { svc, chat, repo } = build(baseCtx());
    chat.chat.mockRejectedValue(new Error('proveedores caídos'));

    await expect(svc.reply(JOB)).rejects.toThrow('proveedores caídos');
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  describe('enabled', () => {
    const prev = process.env['AUTOREPLY_ENABLED'];
    afterEach(() => {
      if (prev === undefined) delete process.env['AUTOREPLY_ENABLED'];
      else process.env['AUTOREPLY_ENABLED'] = prev;
    });

    it('se apaga con AUTOREPLY_ENABLED=false', () => {
      process.env['AUTOREPLY_ENABLED'] = 'false';
      expect(AutoReplyService.enabled).toBe(false);
      delete process.env['AUTOREPLY_ENABLED'];
      expect(AutoReplyService.enabled).toBe(true);
    });
  });
});
