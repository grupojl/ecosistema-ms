import { EventsGateway } from '@/infrastructure/events/events.gateway.js';
import type { Socket } from 'socket.io';

const tenant = { organizationId: 'org-1', agentId: 'agent-1' };

const socketWith = (
  data: Record<string, unknown> = {},
  handshake: Record<string, unknown> = {},
) => {
  const client = {
    id: 's1',
    data,
    join: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
    handshake: { auth: {}, headers: {}, ...handshake },
  };
  return client as unknown as Socket & typeof client;
};

describe('EventsGateway — autenticación y aislamiento entre tenants', () => {
  const auth = { authenticate: jest.fn() };
  const prisma = {
    conversation: { findFirst: jest.fn() },
    agent: { findFirst: jest.fn() },
  };
  let gateway: EventsGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    auth.authenticate.mockResolvedValue(tenant);
    gateway = new EventsGateway(auth as never, prisma as never);
  });

  describe('handshake', () => {
    const run = async (client: Socket): Promise<Error | undefined> => {
      let use!: (s: Socket, next: (e?: Error) => void) => void;
      gateway.afterInit({
        use: (fn: typeof use) => {
          use = fn;
        },
      } as never);
      return new Promise((resolve) => use(client, (e) => resolve(e)));
    };

    it('conexión sin credenciales → rechazada', async () => {
      auth.authenticate.mockRejectedValue(
        new Error('Authorization Bearer requerido'),
      );
      const err = await run(socketWith());
      expect(err?.message).toBe('unauthorized');
    });

    it('con token válido guarda el tenant en el socket', async () => {
      const client = socketWith(
        {},
        { auth: { token: 'abc', organizationId: 'org-1' } },
      );
      expect(await run(client)).toBeUndefined();
      expect(auth.authenticate).toHaveBeenCalledWith({
        authorization: 'Bearer abc',
        organizationId: 'org-1',
      });
      expect((client.data as { tenant: unknown }).tenant).toEqual(tenant);
    });

    it('acepta el token en el header Authorization', async () => {
      const client = socketWith(
        {},
        {
          headers: {
            authorization: 'Bearer xyz',
            'x-organization-id': 'org-1',
          },
        },
      );
      await run(client);
      expect(auth.authenticate).toHaveBeenCalledWith({
        authorization: 'Bearer xyz',
        organizationId: 'org-1',
      });
    });
  });

  it('al conectar se une SOLO a la sala de su organización; sin tenant se desconecta', () => {
    const ok = socketWith({ tenant });
    gateway.handleConnection(ok);
    expect(ok.join).toHaveBeenCalledWith('org:org-1');

    const anon = socketWith();
    gateway.handleConnection(anon);
    expect(anon.disconnect).toHaveBeenCalledWith(true);
    expect(anon.join).not.toHaveBeenCalled();
  });

  it('join:organization de OTRA organización → forbidden', () => {
    const client = socketWith({ tenant });
    expect(gateway.handleJoinOrg('org-2', client)).toEqual({
      status: 'forbidden',
    });
    expect(client.join).not.toHaveBeenCalled();
    expect(gateway.handleJoinOrg('org-1', client)).toEqual({
      status: 'joined',
      room: 'org:org-1',
    });
  });

  it('join:conversation solo si la conversación pertenece a su organización', async () => {
    const client = socketWith({ tenant });
    prisma.conversation.findFirst.mockResolvedValueOnce(null);
    expect(await gateway.handleJoinConv('conv-ajena', client)).toEqual({
      status: 'forbidden',
    });

    prisma.conversation.findFirst.mockResolvedValueOnce({ id: 'conv-1' });
    expect(await gateway.handleJoinConv('conv-1', client)).toEqual({
      status: 'joined',
      room: 'conv:conv-1',
    });
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'conv-ajena',
          channelAccount: { organizationId: 'org-1' },
        },
      }),
    );
  });

  it('join:agent: agente de otra org → forbidden; la sala de su organización está permitida', async () => {
    const client = socketWith({ tenant });
    prisma.agent.findFirst.mockResolvedValueOnce(null);
    expect(await gateway.handleJoinAgent('agent-ajeno', client)).toEqual({
      status: 'forbidden',
    });
    expect(await gateway.handleJoinAgent('org-1', client)).toEqual({
      status: 'joined',
      room: 'agent:org-1',
    });
  });

  it('sin tenant ningún join funciona', async () => {
    const client = socketWith();
    expect(await gateway.handleJoinConv('x', client)).toEqual({
      status: 'forbidden',
    });
    expect(await gateway.handleJoinAgent('x', client)).toEqual({
      status: 'forbidden',
    });
    expect(gateway.handleJoinOrg('org-1', client)).toEqual({
      status: 'forbidden',
    });
  });

  it('emite a las salas correctas', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    (gateway as unknown as { server: unknown }).server = { to };
    gateway.emitNewMessage('org-1', 'conv-1', { id: 'm' });
    expect(to).toHaveBeenCalledWith('conv:conv-1');
    expect(to).toHaveBeenCalledWith('org:org-1');
  });
});
