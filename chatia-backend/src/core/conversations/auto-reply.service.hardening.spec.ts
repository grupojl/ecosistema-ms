// Endurecimiento de las reglas de la respuesta automática: tope por minuto, palabras de pase a humano,
// texto del aviso de handoff y proyecto por defecto. Cada caso fija un comportamiento que antes no se verificaba.
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
  takeoverKeywords: ['humano'],
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

describe('AutoReplyService — endurecimiento', () => {
  afterEach(() => delete process.env['AUTOREPLY_MAX_PER_MIN']);

  describe('tope de respuestas por conversación', () => {
    it('la clave es POR CONVERSACIÓN, la ventana de 60 s y el tope por defecto 8', async () => {
      const { svc, rateLimit } = build(baseCtx({ conversationId: 'conv-9' }));
      await svc.reply(JOB);
      expect(rateLimit.hit).toHaveBeenCalledWith('autoreply:conv-9', 8, 60);
    });

    it('AUTOREPLY_MAX_PER_MIN lo cambia', async () => {
      process.env['AUTOREPLY_MAX_PER_MIN'] = '3';
      const { svc, rateLimit } = build(baseCtx());
      await svc.reply(JOB);
      expect(rateLimit.hit).toHaveBeenCalledWith('autoreply:c1', 3, 60);
    });

    it.each(['0', '-2', 'abc', '', 'Infinity'])(
      'un valor inválido (%p) NO apaga el tope: vuelve a 8',
      async (bad) => {
        process.env['AUTOREPLY_MAX_PER_MIN'] = bad;
        const { svc, rateLimit } = build(baseCtx());
        await svc.reply(JOB);
        expect(rateLimit.hit).toHaveBeenCalledWith('autoreply:c1', 8, 60);
      },
    );

    it('superado el tope: no llama al asistente ni envía nada', async () => {
      const { svc, rateLimit, chat, queue, repo } = build(baseCtx());
      rateLimit.hit.mockResolvedValue({ allowed: false, count: 9, limit: 8 });
      await expect(svc.reply(JOB)).resolves.toEqual({
        status: 'skipped',
        reason: 'rate_limited',
      });
      expect(chat.chat).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
      expect(repo.createOutboundMessage).not.toHaveBeenCalled();
    });
  });

  describe('pase a atención humana', () => {
    it('envía EXACTAMENTE el aviso acordado y pasa la conversación a HUMAN_TAKEOVER con la IA apagada', async () => {
      const { svc, repo, events, chat } = build(
        baseCtx({ inboundText: 'Quiero hablar con un HUMANO por favor' }),
      );
      const out = await svc.reply(JOB);
      expect(out).toEqual({ status: 'handoff', messageId: 'out1' });
      expect(repo.updateStatus).toHaveBeenCalledWith(
        'c1',
        'org1',
        'HUMAN_TAKEOVER',
      );
      expect(repo.updateAiActive).toHaveBeenCalledWith('c1', 'org1', false);
      expect(events.emitEscalation).toHaveBeenCalledWith('org1', 'c1');
      expect(repo.createOutboundMessage).toHaveBeenCalledWith(
        'c1',
        'Entendido, voy a pasar tu consulta a una persona del equipo. En breve te van a responder por acá.',
        { isAiGenerated: true, replyTo: 'm1' },
      );
      expect(chat.chat).not.toHaveBeenCalled();
    });

    it('la palabra se busca sin importar mayúsculas ni espacios alrededor de la palabra configurada', async () => {
      const { svc } = build(
        baseCtx({
          takeoverKeywords: ['  Persona  '],
          inboundText: 'necesito una persona',
        }),
      );
      expect((await svc.reply(JOB)).status).toBe('handoff');
    });

    it('una palabra clave vacía o solo de espacios NO dispara el pase (no coincide con todo mensaje)', async () => {
      const { svc, chat } = build(
        baseCtx({ takeoverKeywords: ['', '   ', '\t'] }),
      );
      expect((await svc.reply(JOB)).status).toBe('replied');
      expect(chat.chat).toHaveBeenCalledTimes(1);
    });

    it('sin palabras configuradas nunca hay pase por palabra', async () => {
      const { svc } = build(
        baseCtx({ takeoverKeywords: [], inboundText: 'quiero un humano' }),
      );
      expect((await svc.reply(JOB)).status).toBe('replied');
    });
  });

  describe('proyecto y errores del asistente', () => {
    it('sin proyecto en el canal se pide el proyecto por defecto (slug undefined); con proyecto, ese slug', async () => {
      const a = build(baseCtx({ projectSlug: null }));
      await a.svc.reply(JOB);
      expect(a.chat.chat.mock.calls[0]?.[0]).toMatchObject({
        projectSlug: undefined,
      });
      const b = build(baseCtx({ projectSlug: 'tramites' }));
      await b.svc.reply(JOB);
      expect(b.chat.chat.mock.calls[0]?.[0]).toMatchObject({
        projectSlug: 'tramites',
      });
    });

    it('asistente sin configurar (404) o sin sesión → se omite, sin reintentos ni envío', async () => {
      const a = build(baseCtx());
      a.chat.chat.mockRejectedValue(new NotFoundException('sin asistente'));
      expect(await a.svc.reply(JOB)).toEqual({
        status: 'skipped',
        reason: 'not_configured',
      });
      const b = build(baseCtx());
      b.chat.chat.mockResolvedValue({ sessionId: '', response: 'x' });
      expect(await b.svc.reply(JOB)).toEqual({
        status: 'skipped',
        reason: 'not_configured',
      });
      expect(b.queue.add).not.toHaveBeenCalled();
    });

    it('un error real del asistente se propaga para que BullMQ reintente', async () => {
      const { svc, chat, queue } = build(baseCtx());
      chat.chat.mockRejectedValue(new Error('timeout del proveedor'));
      await expect(svc.reply(JOB)).rejects.toThrow('timeout del proveedor');
      expect(queue.add).not.toHaveBeenCalled();
    });
  });
});
