import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EcosystemService } from '@/core/ecosystem/ecosystem.service.js';

function build() {
  const ecosystems = {
    findById: jest.fn(),
    findByFirebaseProjectId: jest.fn(),
    create: jest
      .fn()
      .mockImplementation((data: object) => ({ id: 'eco-1', ...data })),
    listSummaries: jest.fn().mockResolvedValue([]),
    updateConfig: jest.fn().mockResolvedValue({ id: 'eco-1' }),
    deactivate: jest.fn().mockResolvedValue(undefined),
  };
  const organizations = {
    findOwnerEcosystemId: jest.fn(),
    upsertForEcosystem: jest.fn().mockResolvedValue({ id: 'org-1' }),
  };
  return {
    svc: new EcosystemService(ecosystems as never, organizations as never),
    ecosystems,
    organizations,
  };
}

describe('EcosystemService.ensureOrganization — aislamiento entre ecosistemas', () => {
  it('crea la organización si no existe', async () => {
    const { svc, organizations } = build();
    organizations.findOwnerEcosystemId.mockResolvedValue(null);
    await svc.ensureOrganization('eco-1', 'org-1', 'Muni', 'muni');
    expect(organizations.upsertForEcosystem).toHaveBeenCalledWith(
      'eco-1',
      'org-1',
      'Muni',
      'muni',
    );
  });

  it('actualiza la de su propio ecosistema', async () => {
    const { svc, organizations } = build();
    organizations.findOwnerEcosystemId.mockResolvedValue({
      ecosystemId: 'eco-1',
    });
    await svc.ensureOrganization('eco-1', 'org-1', 'Muni Nuevo');
    expect(organizations.upsertForEcosystem).toHaveBeenCalledTimes(1);
  });

  it('RECHAZA usar una organización que pertenece a OTRO ecosistema y no la modifica', async () => {
    const { svc, organizations } = build();
    organizations.findOwnerEcosystemId.mockResolvedValue({
      ecosystemId: 'eco-A',
    });
    await expect(
      svc.ensureOrganization('eco-B', 'org-de-A', 'Robada'),
    ).rejects.toThrow(ForbiddenException);
    expect(organizations.upsertForEcosystem).not.toHaveBeenCalled(); // ni siquiera le cambia el nombre
  });
});

describe('EcosystemService — registro y administración', () => {
  const dto = { firebaseProjectId: 'fb-1', name: 'Welver', config: { a: 1 } };

  it('register rechaza un firebaseProjectId repetido', async () => {
    const { svc, ecosystems } = build();
    ecosystems.findByFirebaseProjectId.mockResolvedValue({ id: 'otro' });
    await expect(svc.register(dto as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(ecosystems.create).not.toHaveBeenCalled();
  });

  it('register crea el ecosistema', async () => {
    const { svc, ecosystems } = build();
    ecosystems.findByFirebaseProjectId.mockResolvedValue(null);
    const res = await svc.register(dto as never);
    expect(res.success).toBe(true);
    expect(ecosystems.create).toHaveBeenCalledWith(dto);
  });

  it('resolveByFirebaseProjectId y findAll delegan en el repository', async () => {
    const { svc, ecosystems } = build();
    ecosystems.findByFirebaseProjectId.mockResolvedValue({ id: 'eco-1' });
    expect(await svc.resolveByFirebaseProjectId('fb-1')).toEqual({
      id: 'eco-1',
    });
    expect(await svc.findAll()).toEqual([]);
  });

  it('updateConfig y deactivate: 404 si el ecosistema no existe', async () => {
    const { svc, ecosystems } = build();
    ecosystems.findById.mockResolvedValue(null);
    await expect(svc.updateConfig('x', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(svc.deactivate('x')).rejects.toBeInstanceOf(NotFoundException);
    expect(ecosystems.updateConfig).not.toHaveBeenCalled();
    expect(ecosystems.deactivate).not.toHaveBeenCalled();
  });

  it('updateConfig y deactivate operan sobre un ecosistema existente', async () => {
    const { svc, ecosystems } = build();
    ecosystems.findById.mockResolvedValue({ id: 'eco-1', name: 'Welver' });
    await svc.updateConfig('eco-1', { projectType: 'welver' });
    expect(ecosystems.updateConfig).toHaveBeenCalledWith('eco-1', {
      projectType: 'welver',
    });
    const res = await svc.deactivate('eco-1');
    expect(ecosystems.deactivate).toHaveBeenCalledWith('eco-1');
    expect(res.message).toContain('Welver');
  });
});
