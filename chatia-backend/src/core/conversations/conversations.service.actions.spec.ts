// Acciones del agente sobre una conversación: lo crítico es el AISLAMIENTO (una organización no toca conversaciones de otra)
// y que cada acción emita su evento de analítica solo cuando corresponde.
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

const conv = {
  id: 'c1',
  channelAccountId: 'ca1',
  assignedAgentId: 'ag9',
  tags: ['vip'],
};

function build() {
  const repo = {
    findChannelAccountById: jest
      .fn()
      .mockResolvedValue({ organizationId: 'org1', ecosystemId: 'eco1' }),
    recordInboundMessage: jest.fn().mockResolvedValue({
      conversationId: 'c1',
      contactId: 'k1',
      conversationCreated: true,
      messageId: 'm1',
      duplicate: false,
    }),
    findOwned: jest.fn().mockResolvedValue(conv),
    findDetailed: jest.fn().mockResolvedValue({ id: 'c1' }),
    getOutboundContext: jest.fn().mockResolvedValue(null),
    takeover: jest.fn().mockResolvedValue({ id: 'c1', status: 'HUMAN' }),
    release: jest.fn().mockResolvedValue({ id: 'c1' }),
    resolve: jest.fn().mockResolvedValue({ id: 'c1', status: 'RESOLVED' }),
    softDelete: jest.fn().mockResolvedValue({ id: 'c1' }),
    restore: jest.fn().mockResolvedValue({ id: 'c1' }),
    updateTags: jest.fn().mockResolvedValue({ id: 'c1' }),
    listWithRelations: jest.fn().mockResolvedValue({ data: [] }),
  };
  const analytics = {
    trackConversationCreated: jest.fn(),
    trackMessageSent: jest.fn(),
    trackConversationAssigned: jest.fn(),
    trackConversationResolved: jest.fn(),
  };
  const svc = new ConversationsService(
    repo as never,
    { add: jest.fn() } as never,
    analytics as never,
    { add: jest.fn() } as never,
  );
  return { svc, repo, analytics };
}

describe('ConversationsService — acciones y aislamiento', () => {
  afterEach(() => delete process.env['AUTOREPLY_ENABLED']);

  describe('handleIncomingMessage', () => {
    it('una conversación nueva emite "creada" y "mensaje recibido" con el tenant de la cuenta', async () => {
      const { svc, analytics } = build();
      await svc.handleIncomingMessage('ca1', 'WHATSAPP', MSG);
      expect(analytics.trackConversationCreated).toHaveBeenCalledWith({
        ecosystemId: 'eco1',
        organizationId: 'org1',
        conversationId: 'c1',
        channel: 'WHATSAPP',
        contactId: 'k1',
      });
      expect(analytics.trackMessageSent).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'INBOUND', isAiGenerated: false }),
      );
    });

    it('una conversación existente NO vuelve a emitir "creada"', async () => {
      const { svc, repo, analytics } = build();
      repo.recordInboundMessage.mockResolvedValue({
        conversationId: 'c1',
        contactId: 'k1',
        conversationCreated: false,
        messageId: 'm2',
        duplicate: false,
      });
      await svc.handleIncomingMessage('ca1', 'WHATSAPP', MSG);
      expect(analytics.trackConversationCreated).not.toHaveBeenCalled();
      expect(analytics.trackMessageSent).toHaveBeenCalledTimes(1);
    });

    it('un canal inexistente → 404 y no se registra nada', async () => {
      const { svc, repo } = build();
      repo.findChannelAccountById.mockResolvedValue(null);
      await expect(
        svc.handleIncomingMessage('nope', 'WHATSAPP', MSG),
      ).rejects.toThrow(NotFoundException);
      expect(repo.recordInboundMessage).not.toHaveBeenCalled();
    });
  });

  describe('lectura', () => {
    it('findOne devuelve el detalle de la propia organización', async () => {
      const { svc, repo } = build();
      await expect(svc.findOne('c1', 'org1')).resolves.toEqual({ id: 'c1' });
      expect(repo.findDetailed).toHaveBeenCalledWith('c1', 'org1');
    });

    it('findOne de una conversación ajena → 404', async () => {
      const { svc, repo } = build();
      repo.findDetailed.mockResolvedValue(null);
      await expect(svc.findOne('c1', 'org-OTRA')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('list siempre fuerza la organización del token', async () => {
      const { svc, repo } = build();
      await svc.list('org1', { status: 'OPEN' } as never);
      expect(repo.listWithRelations).toHaveBeenCalledWith({
        status: 'OPEN',
        organizationId: 'org1',
      });
    });
  });

  describe('AISLAMIENTO: una organización ajena no puede ejecutar ninguna acción', () => {
    const actions: Array<
      [string, (s: ConversationsService) => Promise<unknown>, string]
    > = [
      ['takeover', (s) => s.takeover('c1', 'org-OTRA', 'ag1'), 'takeover'],
      ['release', (s) => s.release('c1', 'org-OTRA'), 'release'],
      ['resolve', (s) => s.resolve('c1', 'org-OTRA'), 'resolve'],
      ['softDelete', (s) => s.softDelete('c1', 'org-OTRA'), 'softDelete'],
      ['restore', (s) => s.restore('c1', 'org-OTRA'), 'restore'],
      ['addTag', (s) => s.addTag('c1', 'org-OTRA', 'x'), 'updateTags'],
      ['removeTag', (s) => s.removeTag('c1', 'org-OTRA', 'x'), 'updateTags'],
      [
        'sendManualMessage',
        (s) => s.sendManualMessage('c1', 'org-OTRA', 'hola'),
        'getOutboundContext',
      ],
    ];

    it.each(actions)(
      '%s → 404 y no modifica nada',
      async (_n, run, repoMethod) => {
        const { svc, repo, analytics } = build();
        repo.findOwned.mockResolvedValue(null);
        await expect(run(svc)).rejects.toThrow(NotFoundException);
        expect(
          (repo as unknown as Record<string, jest.Mock>)[repoMethod],
        ).not.toHaveBeenCalled();
        expect(analytics.trackConversationAssigned).not.toHaveBeenCalled();
        expect(analytics.trackConversationResolved).not.toHaveBeenCalled();
      },
    );
  });

  describe('acciones de la propia organización', () => {
    it('takeover asigna al agente y emite "asignada"', async () => {
      const { svc, repo, analytics } = build();
      await expect(svc.takeover('c1', 'org1', 'ag1')).resolves.toMatchObject({
        status: 'HUMAN',
      });
      expect(repo.takeover).toHaveBeenCalledWith('c1', 'org1', 'ag1');
      expect(analytics.trackConversationAssigned).toHaveBeenCalledWith({
        ecosystemId: 'eco1',
        organizationId: 'org1',
        conversationId: 'c1',
        agentId: 'ag1',
      });
    });

    it('takeover sin cuenta de canal no emite analítica pero igual asigna', async () => {
      const { svc, repo, analytics } = build();
      repo.findChannelAccountById.mockResolvedValue(null);
      await svc.takeover('c1', 'org1', 'ag1');
      expect(repo.takeover).toHaveBeenCalled();
      expect(analytics.trackConversationAssigned).not.toHaveBeenCalled();
    });

    it('resolve emite "resuelta" con el agente que la tenía; sin agente manda undefined', async () => {
      const { svc, repo, analytics } = build();
      await svc.resolve('c1', 'org1');
      expect(analytics.trackConversationResolved).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'ag9' }),
      );
      repo.findOwned.mockResolvedValue({ ...conv, assignedAgentId: null });
      await svc.resolve('c1', 'org1');
      expect(analytics.trackConversationResolved).toHaveBeenLastCalledWith(
        expect.objectContaining({ agentId: undefined }),
      );
    });

    it('resolve sin cuenta de canal no emite analítica', async () => {
      const { svc, repo, analytics } = build();
      repo.findChannelAccountById.mockResolvedValue(null);
      await svc.resolve('c1', 'org1');
      expect(repo.resolve).toHaveBeenCalled();
      expect(analytics.trackConversationResolved).not.toHaveBeenCalled();
    });

    it('release, softDelete y restore delegan con la organización del token', async () => {
      const { svc, repo } = build();
      await svc.release('c1', 'org1');
      await svc.softDelete('c1', 'org1');
      await svc.restore('c1', 'org1');
      expect(repo.release).toHaveBeenCalledWith('c1', 'org1');
      expect(repo.softDelete).toHaveBeenCalledWith('c1', 'org1');
      expect(repo.restore).toHaveBeenCalledWith('c1', 'org1');
    });

    it('addTag normaliza y no duplica; removeTag quita sin importar mayúsculas', async () => {
      const { svc, repo } = build();
      await svc.addTag('c1', 'org1', '  Urgente ');
      expect(repo.updateTags).toHaveBeenLastCalledWith('c1', 'org1', [
        'vip',
        'urgente',
      ]);
      await svc.addTag('c1', 'org1', 'VIP');
      expect(repo.updateTags).toHaveBeenLastCalledWith('c1', 'org1', ['vip']);
      await svc.removeTag('c1', 'org1', ' VIP ');
      expect(repo.updateTags).toHaveBeenLastCalledWith('c1', 'org1', []);
    });

    it('sendManualMessage: si el contexto de salida no existe → 404 y no encola', async () => {
      const { svc, repo } = build();
      repo.getOutboundContext.mockResolvedValue(null);
      await expect(svc.sendManualMessage('c1', 'org1', 'hola')).rejects.toThrow(
        NotFoundException,
      );
      expect(
        (repo as unknown as Record<string, jest.Mock>)['createOutboundMessage'],
      ).toBeUndefined();
    });
  });
});
