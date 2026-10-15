import { NotificationsService } from '@/core/notifications/notifications.service.js';

function build() {
  const repo = {
    create: jest.fn().mockImplementation((data: object) => data),
    listForAgent: jest
      .fn()
      .mockResolvedValue({ rows: [{ id: 'n1' }], total: 45, unreadCount: 45 }),
    markRead: jest.fn().mockResolvedValue(2),
    markAllRead: jest.fn().mockResolvedValue(2),
  };
  const events = { emitToAgent: jest.fn() };
  return {
    svc: new NotificationsService(repo as never, events as never),
    repo,
    events,
  };
}

describe('NotificationsService', () => {
  it('create persiste y emite en tiempo real solo al agente destinatario', async () => {
    const { svc, repo, events } = build();
    const n = await svc.create({
      organizationId: 'org',
      agentId: 'ag1',
      type: 'NEW_MESSAGE',
      title: 't',
      body: 'b',
    });
    expect(repo.create.mock.calls[0][0]).toMatchObject({
      organizationId: 'org',
      agentId: 'ag1',
      conversationId: null,
    });
    expect(events.emitToAgent).toHaveBeenCalledWith(
      'ag1',
      'notification:new',
      n,
    );
  });

  it('notifyNewMessage recorta la vista previa a 100 caracteres', async () => {
    const { svc } = build();
    const n = await svc.notifyNewMessage(
      'org',
      'ag1',
      'c1',
      'Ana',
      'x'.repeat(500),
    );
    expect(n.body).toHaveLength(100);
    expect(n.title).toBe('Mensaje de Ana');
    expect(n.type).toBe('NEW_MESSAGE');
  });

  it('notifyNewConversation y notifyEscalation usan su tipo', async () => {
    const { svc } = build();
    expect((await svc.notifyNewConversation('o', 'a', 'c', 'Ana')).type).toBe(
      'NEW_CONVERSATION',
    );
    const esc = await svc.notifyEscalation('o', 'a', 'c', 'Ana');
    expect(esc.type).toBe('ESCALATION');
    expect(esc.body).toContain('Ana');
  });

  it('list pagina, filtra no leídas y devuelve las no leídas aparte', async () => {
    const { svc, repo } = build();
    const res = await svc.list('ag1', true, 3, 20);
    expect(repo.listForAgent).toHaveBeenCalledWith('ag1', true, 40, 20);
    expect(res.pagination).toEqual({ page: 3, limit: 20, total: 45, pages: 3 });
    expect(res.unreadCount).toBe(45);
  });

  it('markRead y markAllRead solo tocan notificaciones del agente', async () => {
    const { svc, repo } = build();
    expect(await svc.markRead('n1', 'ag1')).toEqual({
      success: true,
      updated: 2,
    });
    expect(repo.markRead).toHaveBeenCalledWith('n1', 'ag1');
    await svc.markAllRead('ag1');
    expect(repo.markAllRead).toHaveBeenCalledWith('ag1');
  });
});
