import { OrganizationConfigService } from '@/core/organization-config/organization-config.service.js';
import { DEFAULT_ORG_PROFILE } from '@/core/strategies/project-context.interface.js';

const stored = (organizationId: string) => ({
  organizationId,
  ecosystemId: 'eco',
  plan: 'basic',
  featureFlags: {},
  limits: {},
  timezone: 'America/Argentina/Buenos_Aires',
  locale: 'es-AR',
  updatedAt: new Date(),
});

function build() {
  const repo = {
    findByOrgId: jest.fn(),
    upsert: jest.fn(),
    findAllByEcosystem: jest.fn(),
  };
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
  return {
    svc: new OrganizationConfigService(repo as never, cache as never),
    repo,
    cache,
  };
}

describe('OrganizationConfigService', () => {
  it('resolve usa la caché si existe', async () => {
    const { svc, repo, cache } = build();
    cache.get.mockResolvedValue({ organizationId: 'org', cached: true });
    expect(await svc.resolve('eco', 'org')).toMatchObject({ cached: true });
    expect(repo.findByOrgId).not.toHaveBeenCalled();
  });

  it('resolve sin config guardada devuelve el perfil por defecto del tenant y lo cachea', async () => {
    const { svc, repo, cache } = build();
    repo.findByOrgId.mockResolvedValue(null);
    const p = await svc.resolve('eco', 'org');
    expect(p).toMatchObject({
      ...DEFAULT_ORG_PROFILE,
      organizationId: 'org',
      ecosystemId: 'eco',
    });
    expect(cache.set).toHaveBeenCalledWith('orgcfg:eco:org', p, 300);
  });

  it('resolve NUNCA lanza: si falla el repositorio degrada al perfil por defecto', async () => {
    const { svc, repo } = build();
    repo.findByOrgId.mockRejectedValue(new Error('db caída'));
    expect(await svc.resolve('eco', 'org')).toMatchObject({
      organizationId: 'org',
      ecosystemId: 'eco',
    });
  });

  it('upsert invalida la caché del tenant', async () => {
    const { svc, repo, cache } = build();
    repo.upsert.mockResolvedValue(stored('org'));
    await svc.upsert({ ecosystemId: 'eco', organizationId: 'org' } as never);
    expect(cache.del).toHaveBeenCalledWith('orgcfg:eco:org');
  });

  it('listByEcosystem mapea las filas a perfiles', async () => {
    const { svc, repo } = build();
    repo.findAllByEcosystem.mockResolvedValue([stored('a'), stored('b')]);
    const list = await svc.listByEcosystem('eco');
    expect(list.map((p) => p.organizationId)).toEqual(['a', 'b']);
  });
});
