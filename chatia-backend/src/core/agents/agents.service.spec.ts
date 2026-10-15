import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AgentsService } from '@/core/agents/agents.service.js';
import {
  assertCanUpdateAgent,
  assertRegistrationMatchesToken,
} from '@/core/agents/domain/agent.entity.js';

const member = {
  firebaseUid: 'uid-m',
  organizationId: 'org1',
  role: 'MEMBER' as const,
};
const admin = { ...member, firebaseUid: 'uid-a', role: 'ADMIN' as const };

function build() {
  const repo = {
    upsertByFirebaseUid: jest.fn().mockResolvedValue({ id: 'a1' }),
    findByFirebaseUid: jest.fn().mockResolvedValue({ id: 'a1' }),
    findInOrganization: jest.fn(),
    listActive: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ id: 'a1' }),
  };
  return { svc: new AgentsService(repo as never), repo };
}

describe('agent.entity — reglas de dominio', () => {
  it('un miembro solo puede editar su propio perfil (nombre/avatar)', () => {
    expect(() =>
      assertCanUpdateAgent(member, { firebaseUid: 'uid-m' }, ['name']),
    ).not.toThrow();
    expect(() =>
      assertCanUpdateAgent(member, { firebaseUid: 'otro' }, ['name']),
    ).toThrow('editar a otros');
  });

  it('un miembro NO puede cambiar isActive ni role, ni siquiera el suyo', () => {
    expect(() =>
      assertCanUpdateAgent(member, { firebaseUid: 'uid-m' }, ['isActive']),
    ).toThrow('isActive');
    expect(() =>
      assertCanUpdateAgent(member, { firebaseUid: 'uid-m' }, ['role', 'name']),
    ).toThrow('role');
  });

  it('OWNER/ADMIN pueden editar a cualquiera', () => {
    expect(() =>
      assertCanUpdateAgent(admin, { firebaseUid: 'otro' }, [
        'isActive',
        'role',
      ]),
    ).not.toThrow();
  });

  it('el registro debe coincidir con la identidad del token', () => {
    const token = { firebaseUid: 'uid-m', organizationId: 'org1' };
    expect(() =>
      assertRegistrationMatchesToken(token, { firebaseUid: 'uid-m' }),
    ).not.toThrow();
    expect(() =>
      assertRegistrationMatchesToken(token, { firebaseUid: 'victima' }),
    ).toThrow('firebaseUid');
    expect(() =>
      assertRegistrationMatchesToken(token, {
        firebaseUid: 'uid-m',
        organizationId: 'org-ajena',
      }),
    ).toThrow('organizationId');
  });
});

describe('AgentsService', () => {
  const dto = { firebaseUid: 'uid-m', name: 'Ana', email: 'a@x.com' };

  it('register usa la identidad del TOKEN para crear el agente', async () => {
    const { svc, repo } = build();
    await svc.register(member, { ...dto, organizationId: 'org1' });
    expect(repo.upsertByFirebaseUid).toHaveBeenCalledWith({
      firebaseUid: 'uid-m',
      organizationId: 'org1',
      name: 'Ana',
      email: 'a@x.com',
      avatarUrl: undefined,
    });
  });

  it('register rechaza (403) un body que apunta a otro usuario u organización', async () => {
    const { svc, repo } = build();
    await expect(
      svc.register(member, { ...dto, firebaseUid: 'victima' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.register(member, { ...dto, organizationId: 'org-ajena' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.upsertByFirebaseUid).not.toHaveBeenCalled();
  });

  it('me y list siempre filtran por la organización del token', async () => {
    const { svc, repo } = build();
    await svc.me(member);
    await svc.list(admin);
    expect(repo.findByFirebaseUid).toHaveBeenCalledWith('uid-m', 'org1');
    expect(repo.listActive).toHaveBeenCalledWith('org1');
  });

  it('update: 404 si el agente es de otra organización', async () => {
    const { svc, repo } = build();
    repo.findInOrganization.mockResolvedValue(null);
    await expect(svc.update('a1', admin, { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findInOrganization).toHaveBeenCalledWith('a1', 'org1');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('update: un miembro no puede desactivar ni cambiar el rol de otro (403)', async () => {
    const { svc, repo } = build();
    repo.findInOrganization.mockResolvedValue({
      id: 'a2',
      firebaseUid: 'otro',
    });
    await expect(
      svc.update('a2', member, { isActive: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('update: un miembro puede cambiar su nombre; un admin cambia cualquier campo', async () => {
    const { svc, repo } = build();
    repo.findInOrganization.mockResolvedValue({
      id: 'a1',
      firebaseUid: 'uid-m',
    });
    await svc.update('a1', member, { name: 'Nuevo' });
    expect(repo.update).toHaveBeenLastCalledWith('a1', 'org1', {
      name: 'Nuevo',
    });

    repo.findInOrganization.mockResolvedValue({
      id: 'a2',
      firebaseUid: 'otro',
    });
    await svc.update('a2', admin, { isActive: false, role: 'MEMBER' });
    expect(repo.update).toHaveBeenLastCalledWith('a2', 'org1', {
      isActive: false,
      role: 'MEMBER',
    });
  });
});
