import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { TenantAuthService } from '@/infrastructure/common/services/tenant-auth.service.js';
import { TenantGuard } from '@/infrastructure/common/guards/tenant.guard.js';

const decoded = {
  uid: 'uid-1',
  aud: 'firebase-proj',
  email: 'ana@example.com',
  name: 'Ana',
  organizationId: 'org-1',
  organizationName: 'Muni',
  organizationSlug: 'muni',
  role: 'ADMIN',
  permissions: { chat: { canRead: true, canWrite: true } },
};

describe('TenantAuthService', () => {
  const firebase = { isInitialized: true, verifyIdToken: jest.fn() };
  const ecosystem = {
    resolveByFirebaseProjectId: jest.fn(),
    ensureOrganization: jest.fn(),
  };
  const prisma = { agent: { upsert: jest.fn(), findUnique: jest.fn() } };
  let svc: TenantAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['ALLOW_DEV_AUTH'];
    process.env['NODE_ENV'] = 'test';
    firebase.isInitialized = true;
    firebase.verifyIdToken.mockResolvedValue(decoded);
    ecosystem.resolveByFirebaseProjectId.mockResolvedValue({
      id: 'eco-1',
      isActive: true,
    });
    prisma.agent.upsert.mockResolvedValue({ id: 'agent-1' });
    prisma.agent.findUnique.mockResolvedValue(null);
    svc = new TenantAuthService(
      firebase as never,
      ecosystem as never,
      prisma as never,
    );
  });

  afterEach(() => {
    delete process.env['ALLOW_DEV_AUTH'];
    process.env['NODE_ENV'] = 'test';
  });

  it('autentica un token válido y devuelve el contexto del tenant', async () => {
    const t = await svc.authenticate({
      authorization: 'Bearer abc',
      organizationId: 'org-1',
    });
    expect(t).toMatchObject({
      ecosystemId: 'eco-1',
      organizationId: 'org-1',
      agentId: 'agent-1',
      canWrite: true,
    });
  });

  it('rechaza si el organizationId pedido no es el del token (acceso cruzado entre orgs)', async () => {
    await expect(
      svc.authenticate({
        authorization: 'Bearer abc',
        organizationId: 'org-2',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza sin header de organización', async () => {
    await expect(
      svc.authenticate({ authorization: 'Bearer abc' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza un token inválido, un ecosistema desconocido o desactivado', async () => {
    firebase.verifyIdToken.mockRejectedValueOnce(new Error('bad'));
    await expect(
      svc.authenticate({ authorization: 'Bearer x', organizationId: 'org-1' }),
    ).rejects.toThrow(UnauthorizedException);
    ecosystem.resolveByFirebaseProjectId.mockResolvedValueOnce(null);
    await expect(
      svc.authenticate({ authorization: 'Bearer x', organizationId: 'org-1' }),
    ).rejects.toThrow(ForbiddenException);
    ecosystem.resolveByFirebaseProjectId.mockResolvedValueOnce({
      id: 'eco-1',
      isActive: false,
    });
    await expect(
      svc.authenticate({ authorization: 'Bearer x', organizationId: 'org-1' }),
    ).rejects.toThrow(/desactivado/);
  });

  it('rechaza un uid que ya pertenece a un agente de OTRO ecosistema (no lo toca)', async () => {
    prisma.agent.findUnique.mockResolvedValue({
      organization: { ecosystemId: 'eco-OTRO' },
    });
    await expect(
      svc.authenticate({ authorization: 'Bearer x', organizationId: 'org-1' }),
    ).rejects.toThrow(/otro ecosistema/);
    expect(prisma.agent.upsert).not.toHaveBeenCalled();
  });

  it('un agente existente del MISMO ecosistema sigue funcionando', async () => {
    prisma.agent.findUnique.mockResolvedValue({
      organization: { ecosystemId: 'eco-1' },
    });
    await expect(
      svc.authenticate({ authorization: 'Bearer x', organizationId: 'org-1' }),
    ).resolves.toMatchObject({ agentId: 'agent-1' });
  });

  it('rechaza claims sin permiso de lectura del módulo chat', async () => {
    firebase.verifyIdToken.mockResolvedValue({
      ...decoded,
      permissions: { chat: { canRead: false, canWrite: false } },
    });
    await expect(
      svc.authenticate({ authorization: 'Bearer x', organizationId: 'org-1' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('normaliza el país de mercado a mayúsculas y lo deja undefined si no viene', async () => {
    const withCountry = await svc.authenticate({
      authorization: 'Bearer x',
      organizationId: 'org-1',
      marketCountry: 'ar',
    });
    expect(withCountry.marketCountry).toBe('AR');
    const without = await svc.authenticate({
      authorization: 'Bearer x',
      organizationId: 'org-1',
    });
    expect(without.marketCountry).toBeUndefined();
  });

  it('si el token trae `aud` como lista usa el primero para resolver el ecosistema', async () => {
    firebase.verifyIdToken.mockResolvedValue({
      ...decoded,
      aud: ['proj-a', 'proj-b'],
    });
    await svc.authenticate({
      authorization: 'Bearer x',
      organizationId: 'org-1',
    });
    expect(ecosystem.resolveByFirebaseProjectId).toHaveBeenCalledWith('proj-a');
  });

  it('sin nombre ni email en el token: usa el uid como nombre y un email sintético, sin romper', async () => {
    firebase.verifyIdToken.mockResolvedValue({
      ...decoded,
      name: undefined,
      email: undefined,
    });
    const t = await svc.authenticate({
      authorization: 'Bearer x',
      organizationId: 'org-1',
    });
    expect(t).toMatchObject({ name: 'uid-1', email: '' });
    const arg = prisma.agent.upsert.mock.calls[0]?.[0] as {
      update: { name: string; email: string };
      create: { name: string; email: string };
    };
    expect(arg.update).toMatchObject({
      name: 'uid-1',
      email: 'uid-1@unknown',
    });
    expect(arg.create).toMatchObject({
      name: 'uid-1',
      email: 'uid-1@unknown',
    });
  });

  it('con email pero sin nombre: el nombre es el email', async () => {
    firebase.verifyIdToken.mockResolvedValue({ ...decoded, name: undefined });
    const t = await svc.authenticate({
      authorization: 'Bearer x',
      organizationId: 'org-1',
    });
    expect(t.name).toBe('ana@example.com');
  });

  it('un permiso de chat sin canWrite se RECHAZA (403): nunca se asume permiso de escritura', async () => {
    firebase.verifyIdToken.mockResolvedValue({
      ...decoded,
      permissions: { chat: { canRead: true } },
    });
    await expect(
      svc.authenticate({ authorization: 'Bearer x', organizationId: 'org-1' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.agent.upsert).not.toHaveBeenCalled();
  });

  describe('bypass de desarrollo (casos de borde)', () => {
    it('modo dev sin Firebase y sin x-organization-id → 401 con mensaje claro', async () => {
      process.env['ALLOW_DEV_AUTH'] = 'true';
      firebase.isInitialized = false;
      await expect(svc.authenticate({})).rejects.toThrow(
        /x-organization-id requerido/,
      );
    });

    it('modo dev con Firebase inicializado y sin Bearer: usa el header y normaliza el país', async () => {
      process.env['ALLOW_DEV_AUTH'] = 'true';
      const t = await svc.authenticate({
        organizationId: 'org-dev',
        marketCountry: 'br',
      });
      expect(t).toMatchObject({
        ecosystemId: 'dev',
        organizationId: 'org-dev',
        marketCountry: 'BR',
      });
      expect(firebase.verifyIdToken).not.toHaveBeenCalled();
    });

    it('modo dev con Firebase inicializado, sin Bearer ni header → 401', async () => {
      process.env['ALLOW_DEV_AUTH'] = 'true';
      await expect(svc.authenticate({})).rejects.toThrow(/Bearer/);
    });
  });

  describe('bypass de desarrollo', () => {
    it('SIN ALLOW_DEV_AUTH no hay bypass aunque NODE_ENV no sea production (antes sí lo había)', async () => {
      firebase.isInitialized = false;
      await expect(
        svc.authenticate({ organizationId: 'cualquiera' }),
      ).rejects.toThrow(UnauthorizedException);
      firebase.isInitialized = true;
      await expect(
        svc.authenticate({ organizationId: 'cualquiera' }),
      ).rejects.toThrow(/Bearer/);
    });

    it('con ALLOW_DEV_AUTH=true y fuera de producción permite x-organization-id', async () => {
      process.env['ALLOW_DEV_AUTH'] = 'true';
      firebase.isInitialized = false;
      const t = await svc.authenticate({ organizationId: 'org-dev' });
      expect(t).toMatchObject({
        ecosystemId: 'dev',
        organizationId: 'org-dev',
      });
    });

    it('en producción NUNCA hay bypass, ni siquiera con ALLOW_DEV_AUTH=true', async () => {
      process.env['ALLOW_DEV_AUTH'] = 'true';
      process.env['NODE_ENV'] = 'production';
      firebase.isInitialized = false;
      await expect(
        svc.authenticate({ organizationId: 'org-x' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(svc.devAuthAllowed).toBe(false);
    });
  });
});

describe('TenantGuard', () => {
  it('puebla request.tenant con lo que resuelve el servicio', async () => {
    const auth = {
      authenticate: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
    };
    const request: Record<string, unknown> = {
      headers: {
        authorization: 'Bearer t',
        'x-organization-id': 'org-1',
        'x-market-country': 'ar',
      },
    };
    const ctx = { switchToHttp: () => ({ getRequest: () => request }) };
    const ok = await new TenantGuard(auth as never).canActivate(ctx as never);
    expect(ok).toBe(true);
    expect(request['tenant']).toEqual({ organizationId: 'org-1' });
    expect(auth.authenticate).toHaveBeenCalledWith({
      authorization: 'Bearer t',
      organizationId: 'org-1',
      marketCountry: 'ar',
    });
  });
});
