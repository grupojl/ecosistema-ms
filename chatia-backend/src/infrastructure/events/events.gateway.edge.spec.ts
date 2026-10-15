// Bordes del handshake del WebSocket: formatos de credencial y motivos de rechazo.
import { EventsGateway } from '@/infrastructure/events/events.gateway.js';
import type { Socket } from 'socket.io';

const socketWith = (handshake: Record<string, unknown>) =>
  ({
    id: 's1',
    data: {},
    join: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
    handshake,
  }) as unknown as Socket;

describe('EventsGateway — bordes del handshake', () => {
  const auth = { authenticate: jest.fn() };
  const prisma = {
    conversation: { findFirst: jest.fn() },
    agent: { findFirst: jest.fn() },
  };
  let gateway: EventsGateway;

  const handshake = (client: Socket): Promise<Error | undefined> => {
    let use!: (s: Socket, next: (e?: Error) => void) => void;
    gateway.afterInit({
      use: (fn: typeof use) => {
        use = fn;
      },
    } as never);
    return new Promise((resolve) => use(client, (e) => resolve(e)));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auth.authenticate.mockResolvedValue({
      organizationId: 'org-1',
      agentId: 'a1',
    });
    gateway = new EventsGateway(auth as never, prisma as never);
  });

  it('un token que ya trae "Bearer " no se duplica', async () => {
    await handshake(
      socketWith({ auth: { token: 'Bearer ya-viene', organizationId: 'o' } }),
    );
    expect(auth.authenticate).toHaveBeenCalledWith({
      authorization: 'Bearer ya-viene',
      organizationId: 'o',
    });
  });

  it('handshake sin objeto auth: cae a los headers y no rompe', async () => {
    await handshake(
      socketWith({
        auth: undefined,
        headers: { authorization: 'Bearer h', 'x-organization-id': 'org-h' },
      }),
    );
    expect(auth.authenticate).toHaveBeenCalledWith({
      authorization: 'Bearer h',
      organizationId: 'org-h',
    });
  });

  it('credenciales que no son string en auth se ignoran (no se confía en tipos del cliente)', async () => {
    await handshake(
      socketWith({
        auth: { token: { $ne: null }, organizationId: 123 },
        headers: { authorization: 'Bearer h', 'x-organization-id': 'org-h' },
      }),
    );
    expect(auth.authenticate).toHaveBeenCalledWith({
      authorization: 'Bearer h',
      organizationId: 'org-h',
    });
  });

  it('sin ninguna credencial se llama al servicio sin token y el rechazo no filtra el motivo', async () => {
    auth.authenticate.mockRejectedValue('motivo interno con detalles');
    const err = await handshake(socketWith({ auth: {}, headers: {} }));
    expect(auth.authenticate).toHaveBeenCalledWith({
      authorization: undefined,
      organizationId: undefined,
    });
    expect(err?.message).toBe('unauthorized');
  });

  it('join:agent de un agente que no existe en la organización → forbidden', async () => {
    prisma.agent.findFirst.mockResolvedValue(null);
    const client = socketWith({});
    (client.data as Record<string, unknown>)['tenant'] = {
      organizationId: 'org-1',
      agentId: 'a1',
    };
    expect(await gateway.handleJoinAgent('agent-x', client)).toEqual({
      status: 'forbidden',
    });
    expect(prisma.agent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }) as object,
      }),
    );
  });
});
