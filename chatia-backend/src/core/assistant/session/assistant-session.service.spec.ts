import { NotFoundException } from '@nestjs/common';
import { AssistantSessionService } from '@/core/assistant/session/assistant-session.service.js';

function build(session: Record<string, unknown> | null = null) {
  const repo = {
    findForChannel: jest.fn().mockResolvedValue(session),
    findLatestByUser: jest.fn().mockResolvedValue(session),
    findById: jest.fn().mockResolvedValue(session),
    create: jest
      .fn()
      .mockImplementation((data: object) => ({ id: 's1', ...data })),
    appendMessage: jest.fn().mockResolvedValue(true),
    reset: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return { svc: new AssistantSessionService(repo as never), repo };
}

describe('AssistantSessionService', () => {
  it('getOrCreate devuelve la sesión existente sin crear otra', async () => {
    const { svc, repo } = build({ id: 'old' });
    expect(await svc.getOrCreate('cfg', 'org', 'u', 'web')).toEqual({
      id: 'old',
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('getOrCreate busca y crea acotado a la organización', async () => {
    const { svc, repo } = build(null);
    const s = await svc.getOrCreate('cfg', 'org', 'u', 'web');
    expect(s.id).toBe('s1');
    expect(repo.findForChannel).toHaveBeenCalledWith('cfg', 'org', 'u', 'web');
    expect(repo.create).toHaveBeenCalledWith({
      assistantConfigId: 'cfg',
      organizationId: 'org',
      externalUserId: 'u',
      channel: 'web',
    });
  });

  it('appendMessage delega UNA sola escritura atómica (sin leer y reescribir el historial)', async () => {
    const { svc, repo } = build({ id: 's1', history: [] });
    const msg = await svc.appendMessage('s1', 'assistant', 'b');
    expect(msg).toMatchObject({ role: 'assistant', content: 'b' });
    expect(repo.appendMessage).toHaveBeenCalledTimes(1);
    expect(repo.appendMessage).toHaveBeenCalledWith('s1', msg);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('appendMessage: 404 si la sesión no existe', async () => {
    const { svc, repo } = build(null);
    repo.appendMessage.mockResolvedValue(false);
    await expect(svc.appendMessage('x', 'user', 'hola')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getHistory devuelve los últimos N', async () => {
    const history = Array.from({ length: 15 }, (_, i) => ({
      role: 'user',
      content: String(i),
      createdAt: 'x',
    }));
    const { svc } = build({ id: 's1', history });
    const last = await svc.getHistory('s1', 3);
    expect(last.map((m) => m.content)).toEqual(['12', '13', '14']);
    expect(await svc.getHistory('s1')).toHaveLength(10);
  });

  it('getHistory tolera un historial corrupto y da 404 si no hay sesión', async () => {
    const corrupt = build({ id: 's1', history: { x: 1 } });
    expect(await corrupt.svc.getHistory('s1')).toEqual([]);
    const none = build(null);
    await expect(none.svc.getHistory('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resetSession delega en el repository', async () => {
    const { svc, repo } = build({ id: 's1' });
    await svc.resetSession('s1');
    expect(repo.reset).toHaveBeenCalledWith('s1');
  });

  it('findByUser usa la sesión más reciente del usuario', async () => {
    const { svc, repo } = build({ id: 's9' });
    expect(await svc.findByUser('cfg', 'org', 'u')).toEqual({ id: 's9' });
    expect(repo.findLatestByUser).toHaveBeenCalledWith('cfg', 'org', 'u');
  });

  it('deleteByUser borra la sesión encontrada y devuelve null si no hay', async () => {
    const found = build({ id: 's1' });
    expect(await found.svc.deleteByUser('cfg', 'org', 'u')).toEqual({
      id: 's1',
    });
    expect(found.repo.delete).toHaveBeenCalledWith('s1');
    const none = build(null);
    expect(await none.svc.deleteByUser('cfg', 'org', 'u')).toBeNull();
    expect(none.repo.delete).not.toHaveBeenCalled();
  });
});
