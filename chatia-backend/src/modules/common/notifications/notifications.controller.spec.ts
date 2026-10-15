// Las notificaciones son del AGENTE autenticado: todo se acota a tenant.agentId; sin agente no se toca nada.
import { NotificationsController } from '@/modules/common/notifications/notifications.controller.js';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';

describe('NotificationsController', () => {
  const svc = {
    list: jest.fn().mockResolvedValue({ success: true, data: ['n'] }),
    markAllRead: jest.fn().mockResolvedValue({ success: true, updated: 2 }),
    markRead: jest.fn().mockResolvedValue({ success: true, updated: 1 }),
  };
  const controller = new NotificationsController(svc as never);
  const withAgent = { agentId: 'ag1' } as TenantContext;
  const noAgent = {} as TenantContext;

  beforeEach(() => jest.clearAllMocks());

  it('list usa el agente del token y pasa el filtro y la página', async () => {
    await controller.list(withAgent, { read: true, page: 2 } as never);
    expect(svc.list).toHaveBeenCalledWith('ag1', true, 2);
  });

  it('sin agente (token sin agentId) devuelve vacío sin consultar', () => {
    expect(controller.list(noAgent, {} as never)).toEqual({
      success: true,
      data: [],
    });
    expect(svc.list).not.toHaveBeenCalled();
  });

  it('markAllRead y markRead solo actúan sobre el agente del token', async () => {
    await controller.markAllRead(withAgent);
    await controller.markRead('n9', withAgent);
    expect(svc.markAllRead).toHaveBeenCalledWith('ag1');
    expect(svc.markRead).toHaveBeenCalledWith('n9', 'ag1');
  });

  it('sin agente, marcar como leída no hace nada y responde ok', () => {
    expect(controller.markAllRead(noAgent)).toEqual({ success: true });
    expect(controller.markRead('n9', noAgent)).toEqual({ success: true });
    expect(svc.markAllRead).not.toHaveBeenCalled();
    expect(svc.markRead).not.toHaveBeenCalled();
  });
});
