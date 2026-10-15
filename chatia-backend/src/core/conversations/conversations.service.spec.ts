import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from '@/core/conversations/conversations.service.js';
import type { IncomingMessage } from '@/infrastructure/channels/channel.interface.js';

const MSG = {
  senderExternalId: '549',
  senderName: 'Ana',
  senderPhone: '549',
  content: 'hola',
  externalId: 'wamid.1',
} as unknown as IncomingMessage;

function build(duplicate = false) {
  const repo = {
    findChannelAccountById: jest
      .fn()
      .mockResolvedValue({ organizationId: 'org1', ecosystemId: 'eco1' }),
    recordInboundMessage: jest.fn().mockResolvedValue({
      conversationId: 'c1',
      contactId: 'k1',
      conversationCreated: false,
      messageId: 'm1',
      duplicate,
    }),
    findOwned: jest.fn().mockResolvedValue({ id: 'c1' }),
    getOutboundContext: jest.fn().mockResolvedValue({
      channelType: 'WHATSAPP',
      externalId: 'phone-id',
      accessToken: 'tok',
      extraConfig: {},
      webhookVerifyToken: 'vt',
      recipientExternalId: '549',
    }),
    createOutboundMessage: jest.fn().mockResolvedValue({ id: 'out1' }),
  };
  const outQueue = { add: jest.fn() };
  const replyQueue = { add: jest.fn() };
  const svc = new ConversationsService(
    repo as never,
    outQueue as never,
    undefined,
    replyQueue as never,
  );
  return { svc, repo, outQueue, replyQueue };
}

describe('ConversationsService', () => {
  afterEach(() => delete process.env['AUTOREPLY_ENABLED']);

  describe('handleIncomingMessage', () => {
    it('encola la respuesta automática con jobId idempotente', async () => {
      const { svc, replyQueue } = build();
      await svc.handleIncomingMessage('ca1', 'WHATSAPP', MSG);

      expect(replyQueue.add).toHaveBeenCalledWith(
        'auto-reply',
        { conversationId: 'c1', inboundMessageId: 'm1' },
        expect.objectContaining({ jobId: 'reply_m1', attempts: 3 }),
      );
    });

    it('no responde dos veces a un webhook duplicado', async () => {
      const { svc, replyQueue } = build(true);
      await svc.handleIncomingMessage('ca1', 'WHATSAPP', MSG);
      expect(replyQueue.add).not.toHaveBeenCalled();
    });

    it('no encola con AUTOREPLY_ENABLED=false', async () => {
      process.env['AUTOREPLY_ENABLED'] = 'false';
      const { svc, replyQueue } = build();
      await svc.handleIncomingMessage('ca1', 'WHATSAPP', MSG);
      expect(replyQueue.add).not.toHaveBeenCalled();
    });

    it('falla si la cuenta del canal no existe', async () => {
      const { svc, repo } = build();
      repo.findChannelAccountById.mockResolvedValue(null);
      await expect(
        svc.handleIncomingMessage('x', 'WHATSAPP', MSG),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('acciones sobre la conversación', () => {
    function withRepo() {
      const b = build();
      Object.assign(b.repo, {
        listWithRelations: jest.fn().mockResolvedValue({ data: [] }),
        findDetailed: jest.fn(),
        findOwned: jest.fn().mockResolvedValue({
          id: 'c1',
          channelAccountId: 'ca1',
          assignedAgentId: 'ag1',
          tags: ['a'],
        }),
        takeover: jest.fn().mockResolvedValue({ id: 'c1' }),
        release: jest.fn().mockResolvedValue({ id: 'c1' }),
        resolve: jest.fn().mockResolvedValue({ id: 'c1' }),
        softDelete: jest.fn().mockResolvedValue({ id: 'c1' }),
        restore: jest.fn().mockResolvedValue({ id: 'c1' }),
        updateTags: jest.fn().mockResolvedValue({ id: 'c1' }),
      });
      return b.repo as typeof b.repo & Record<string, jest.Mock>;
    }
    const analytics = {
      trackConversationAssigned: jest.fn(),
      trackConversationResolved: jest.fn(),
      trackConversationCreated: jest.fn(),
      trackMessageSent: jest.fn(),
    };
    const make = () => {
      const repo = withRepo();
      const svc = new ConversationsService(
        repo as never,
        { add: jest.fn() } as never,
        analytics as never,
        undefined,
      );
      return { svc, repo };
    };
    beforeEach(() => jest.clearAllMocks());

    it('list inyecta SIEMPRE la organización del caller', async () => {
      const { svc, repo } = make();
      await svc.list('org1', { page: 1 } as never);
      expect(repo.listWithRelations).toHaveBeenCalledWith({
        page: 1,
        organizationId: 'org1',
      });
    });

    it('findOne: 404 si no pertenece a la organización', async () => {
      const { svc, repo } = make();
      repo.findDetailed.mockResolvedValue(null);
      await expect(svc.findOne('c1', 'otra')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('toda acción verifica la propiedad antes de actuar', async () => {
      const { svc, repo } = make();
      repo.findOwned.mockResolvedValue(null);
      for (const act of [
        () => svc.takeover('c1', 'otra', 'ag1'),
        () => svc.release('c1', 'otra'),
        () => svc.resolve('c1', 'otra'),
        () => svc.softDelete('c1', 'otra'),
        () => svc.restore('c1', 'otra'),
        () => svc.addTag('c1', 'otra', 't'),
        () => svc.removeTag('c1', 'otra', 't'),
        () => svc.sendManualMessage('c1', 'otra', 'hola'),
      ]) {
        await expect(act()).rejects.toBeInstanceOf(NotFoundException);
      }
      expect(repo.takeover).not.toHaveBeenCalled();
      expect(repo.resolve).not.toHaveBeenCalled();
      expect(repo.softDelete).not.toHaveBeenCalled();
    });

    it('takeover y resolve registran analytics con el ecosistema de la cuenta', async () => {
      const { svc, repo } = make();
      repo.findChannelAccountById.mockResolvedValue({ ecosystemId: 'eco1' });
      await svc.takeover('c1', 'org1', 'ag9');
      expect(analytics.trackConversationAssigned).toHaveBeenCalledWith({
        ecosystemId: 'eco1',
        organizationId: 'org1',
        conversationId: 'c1',
        agentId: 'ag9',
      });
      await svc.resolve('c1', 'org1');
      expect(analytics.trackConversationResolved).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'ag1' }),
      );
    });

    it('release, softDelete y restore delegan en el repositorio', async () => {
      const { svc, repo } = make();
      await svc.release('c1', 'org1');
      await svc.softDelete('c1', 'org1');
      await svc.restore('c1', 'org1');
      expect(repo.release).toHaveBeenCalledWith('c1', 'org1');
      expect(repo.softDelete).toHaveBeenCalledWith('c1', 'org1');
      expect(repo.restore).toHaveBeenCalledWith('c1', 'org1');
    });

    it('addTag / removeTag actualizan el set de etiquetas', async () => {
      const { svc, repo } = make();
      await svc.addTag('c1', 'org1', 'b');
      expect(repo.updateTags).toHaveBeenLastCalledWith('c1', 'org1', [
        'a',
        'b',
      ]);
      await svc.removeTag('c1', 'org1', 'a');
      expect(repo.updateTags).toHaveBeenLastCalledWith('c1', 'org1', []);
    });
  });

  describe('sendManualMessage', () => {
    it('incluye externalId y webhookVerifyToken en el job de salida', async () => {
      const { svc, outQueue } = build();
      await svc.sendManualMessage('c1', 'org1', 'respuesta del agente');

      const [, data] = outQueue.add.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(data).toMatchObject({
        messageId: 'out1',
        externalId: 'phone-id',
        webhookVerifyToken: 'vt',
        text: 'respuesta del agente',
      });
    });
  });
});
