import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '@/core/projects/projects.service.js';

function build() {
  const repo = {
    findBySlug: jest.fn(),
    findDetailedBySlug: jest.fn(),
    findByIdInOrganization: jest.fn(),
    listWithCounts: jest.fn().mockResolvedValue([]),
    create: jest
      .fn()
      .mockImplementation((data: object) => ({ id: 'p1', ...data })),
    update: jest
      .fn()
      .mockImplementation((_o: string, _s: string, data: object) => ({
        id: 'p1',
        ...data,
      })),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  return { svc: new ProjectsService(repo as never), repo };
}

describe('ProjectsService', () => {
  it('create genera el slug desde el nombre (sin tildes ni símbolos)', async () => {
    const { svc, repo } = build();
    repo.findBySlug.mockResolvedValue(null);
    const res = await svc.create('org', {
      name: 'Atención Ciudadana 2026!',
    } as never);
    expect(res.data.slug).toBe('atencion-ciudadana-2026');
    expect(res.data.organizationId).toBe('org');
  });

  it('create rechaza un slug repetido en la organización', async () => {
    const { svc, repo } = build();
    repo.findBySlug.mockResolvedValue({ id: 'otro' });
    await expect(
      svc.create('org', { name: 'X', slug: 'x' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('findAll y findOneById filtran por organización', async () => {
    const { svc, repo } = build();
    await svc.findAll('org');
    expect(repo.listWithCounts).toHaveBeenCalledWith('org');

    repo.findByIdInOrganization.mockResolvedValue(null);
    await expect(svc.findOneById('p', 'org')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findByIdInOrganization).toHaveBeenCalledWith('p', 'org');
  });

  it('findOne: 404 si no existe y devuelve el detalle si sí', async () => {
    const { svc, repo } = build();
    repo.findDetailedBySlug.mockResolvedValue(null);
    await expect(svc.findOne('x', 'org')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    repo.findDetailedBySlug.mockResolvedValue({ id: 'p1' });
    expect((await svc.findOne('x', 'org')).data).toEqual({ id: 'p1' });
  });

  it('update detecta conflicto al cambiar de slug', async () => {
    const { svc, repo } = build();
    repo.findDetailedBySlug.mockResolvedValue({ id: 'p1' });
    repo.findBySlug.mockResolvedValue({ id: 'p2' }); // el nuevo slug ya existe
    await expect(
      svc.update('a', 'org', { slug: 'b' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('update y remove actúan sobre el slug de la organización', async () => {
    const { svc, repo } = build();
    repo.findDetailedBySlug.mockResolvedValue({ id: 'p1' });
    await svc.update('a', 'org', { name: 'Nuevo' } as never);
    expect(repo.update).toHaveBeenCalledWith('org', 'a', { name: 'Nuevo' });
    const res = await svc.remove('a', 'org');
    expect(res.success).toBe(true);
    expect(repo.remove).toHaveBeenCalledWith('org', 'a');
  });
});
