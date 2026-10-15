import { OrganizationsService } from '@/core/organizations/organizations.service.js';

describe('OrganizationsService', () => {
  const repo = { ensureLocal: jest.fn(), findById: jest.fn() };
  let svc: OrganizationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new OrganizationsService(repo as never);
  });

  it('ensureExists delega en el repository', async () => {
    repo.ensureLocal.mockResolvedValue(undefined);
    await svc.ensureExists('org-1', 'Muni', 'muni');
    expect(repo.ensureLocal).toHaveBeenCalledWith('org-1', 'Muni', 'muni');
  });

  it('ensureExists NUNCA rompe el flujo principal (se llama en cada request)', async () => {
    repo.ensureLocal.mockRejectedValue(new Error('db'));
    await expect(svc.ensureExists('org-1', 'M', 'm')).resolves.toBeUndefined();
  });

  it('findOne busca por id', async () => {
    repo.findById.mockResolvedValue({ id: 'org-1' });
    expect(await svc.findOne('org-1')).toEqual({ id: 'org-1' });
  });
});
