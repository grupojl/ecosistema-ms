import { NotFoundException } from '@nestjs/common';
import { MessagesService } from '@/core/messages/messages.service.js';

function build() {
  const repo = {
    conversationBelongsTo: jest.fn(),
    listByConversation: jest
      .fn()
      .mockResolvedValue({ messages: [{ id: 'm1' }], total: 120 }),
    statsForOrganization: jest.fn(),
  };
  return { svc: new MessagesService(repo as never), repo };
}

describe('MessagesService', () => {
  it('listByConversation verifica que la conversación sea de la organización', async () => {
    const { svc, repo } = build();
    repo.conversationBelongsTo.mockResolvedValue(false);
    await expect(
      svc.listByConversation('c1', 'otra-org'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.conversationBelongsTo).toHaveBeenCalledWith('c1', 'otra-org');
    expect(repo.listByConversation).not.toHaveBeenCalled();
  });

  it('listByConversation pagina', async () => {
    const { svc, repo } = build();
    repo.conversationBelongsTo.mockResolvedValue(true);
    const res = await svc.listByConversation('c1', 'org', 2, 50);
    expect(repo.listByConversation).toHaveBeenCalledWith('c1', 50, 50);
    expect(res.data).toEqual([{ id: 'm1' }]);
    expect(res.pagination).toEqual({
      page: 2,
      limit: 50,
      total: 120,
      pages: 3,
    });
  });

  it('getStats pide las estadísticas de la organización', async () => {
    const { svc, repo } = build();
    const stats = {
      total: 7,
      inbound: 4,
      outbound: 3,
      aiGenerated: 2,
      totalTokensUsed: 0,
    };
    repo.statsForOrganization.mockResolvedValue(stats);
    const res = await svc.getStats('org');
    expect(repo.statsForOrganization).toHaveBeenCalledWith('org');
    expect(res).toEqual({ success: true, data: stats });
  });
});
