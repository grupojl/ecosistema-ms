import { NotificationsService } from '@/core/notifications/notifications.service.js';

function build() {
  const repo = {
    create: jest.fn().mockImplementation((data: object) => data),
    listForAgent: jest
      .fn()
      .mockResolvedValue({ rows: [], total: 45, unreadCount: 3 }),
    markRead: jest.fn().mockResolvedValue(1),
    markAllRead: jest.fn().mockResolvedValue(7),
  };
  const events = { emitToAgent: jest.fn() };
  return {
    svc: new NotificationsService(repo as never, events as never),
    repo,
    events,
  };
}

describe('NotificationsService — textos y paginación', () => {
  it.each([
    ['notifyNewConversation', 'inició una conversación', 'NEW_CONVERSATION'],
    ['notifyEscalation', 'necesita hablar con un agente', 'ESCALATION'],
  ] as const)(
    '%s: con nombre lo usa; sin nombre dice "Un contacto"',
    async (method, suffix, type) => {
      const { svc, repo } = build();
      await svc[method]('org', 'ag1', 'c1', 'Ana');
      await svc[method]('org', 'ag1', 'c1', undefined as never);
      expect(repo.create.mock.calls[0]?.[0]).toMatchObject({
        type,
        conversationId: 'c1',
        body: `Ana ${suffix}`,
      });
      expect(repo.create.mock.calls[1]?.[0]).toMatchObject({
        body: `Un contacto ${suffix}`,
      });
    },
  );

  it('notifyNewMessage: título con el nombre (o "contacto") y vista previa recortada a 100 caracteres', async () => {
    const { svc, repo } = build();
    await svc.notifyNewMessage('org', 'ag1', 'c1', 'Ana', 'x'.repeat(250));
    await svc.notifyNewMessage('org', 'ag1', 'c1', undefined as never, 'hola');
    const first = repo.create.mock.calls[0]?.[0] as {
      title: string;
      body: string;
      type: string;
    };
    expect(first).toMatchObject({
      type: 'NEW_MESSAGE',
      title: 'Mensaje de Ana',
    });
    expect(first.body).toHaveLength(100);
    expect(repo.create.mock.calls[1]?.[0]).toMatchObject({
      title: 'Mensaje de contacto',
      body: 'hola',
    });
  });

  it('list usa página 1 y 20 por defecto (offset 0) y calcula las páginas', async () => {
    const { svc, repo } = build();
    const res = await svc.list('ag1');
    expect(repo.listForAgent).toHaveBeenCalledWith('ag1', false, 0, 20);
    expect(res).toMatchObject({
      success: true,
      unreadCount: 3,
      pagination: { page: 1, limit: 20, total: 45, pages: 3 },
    });
  });

  it('list traduce página y tamaño a offset y respeta el filtro de no leídas', async () => {
    const { svc, repo } = build();
    await svc.list('ag1', true, 3, 10);
    expect(repo.listForAgent).toHaveBeenCalledWith('ag1', true, 20, 10);
  });

  it('markRead y markAllRead informan cuántas filas se actualizaron, acotadas al agente', async () => {
    const { svc, repo } = build();
    expect(await svc.markRead('n1', 'ag1')).toEqual({
      success: true,
      updated: 1,
    });
    expect(repo.markRead).toHaveBeenCalledWith('n1', 'ag1');
    expect(await svc.markAllRead('ag1')).toEqual({ success: true, updated: 7 });
    expect(repo.markAllRead).toHaveBeenCalledWith('ag1');
  });
});
