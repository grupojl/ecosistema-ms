import { NotFoundException } from '@nestjs/common';
import { AssistantConfigService } from '@/core/assistant/config/assistant-config.service.js';

function build() {
  const configs = {
    findByProjectId: jest.fn(),
    findOwned: jest.fn(),
    create: jest
      .fn()
      .mockImplementation((data: object) => ({ id: 'cfg-new', ...data })),
    update: jest.fn().mockImplementation((_p: string, data: object) => ({
      id: 'cfg',
      ...data,
    })),
    setEnabled: jest.fn().mockResolvedValue({ id: 'cfg' }),
  };
  const projects = {
    findBySlugWithConfigs: jest.fn(),
    findDefaultActiveWithConfigs: jest.fn(),
    upsertBySlug: jest.fn(),
  };
  const organizations = { findNameAndSlug: jest.fn() };
  return {
    svc: new AssistantConfigService(
      configs as never,
      projects as never,
      organizations as never,
    ),
    configs,
    projects,
    organizations,
  };
}

describe('AssistantConfigService', () => {
  it('getOrCreate devuelve la existente o crea con el prompt por defecto', async () => {
    const { svc, configs } = build();
    configs.findByProjectId.mockResolvedValueOnce({ id: 'x' });
    expect(await svc.getOrCreate('p1', 'org')).toEqual({ id: 'x' });

    configs.findByProjectId.mockResolvedValueOnce(null);
    const created = await svc.getOrCreate('p1', 'org');
    expect(created).toMatchObject({ projectId: 'p1', organizationId: 'org' });
    expect(created.systemPrompt).toContain('asistente virtual');
  });

  it('update y toggleEnabled exigen que la config sea de la organización', async () => {
    const { svc, configs } = build();
    configs.findOwned.mockResolvedValue(null);
    await expect(
      svc.update('p1', 'otra-org', {} as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      svc.toggleEnabled('p1', 'otra-org', true),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(configs.update).not.toHaveBeenCalled();
    expect(configs.setEnabled).not.toHaveBeenCalled();

    configs.findOwned.mockResolvedValue({ id: 'cfg' });
    await svc.toggleEnabled('p1', 'org', false);
    expect(configs.setEnabled).toHaveBeenCalledWith('p1', false);
    await svc.update('p1', 'org', { personaName: 'Sofi' } as never);
    expect(configs.update).toHaveBeenCalledWith('p1', { personaName: 'Sofi' });
  });

  it('findByProjectSlug: 404 si no existe, crea la config si el proyecto no tiene', async () => {
    const { svc, configs, projects } = build();
    projects.findBySlugWithConfigs.mockResolvedValueOnce(null);
    await expect(svc.findByProjectSlug('x', 'org')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    projects.findBySlugWithConfigs.mockResolvedValueOnce({
      id: 'p1',
      assistantConfigs: [{ id: 'c1' }],
    });
    expect(await svc.findByProjectSlug('x', 'org')).toEqual({ id: 'c1' });

    projects.findBySlugWithConfigs.mockResolvedValueOnce({
      id: 'p1',
      assistantConfigs: [],
    });
    configs.findByProjectId.mockResolvedValueOnce(null);
    expect(await svc.findByProjectSlug('x', 'org')).toMatchObject({
      projectId: 'p1',
    });
  });

  describe('findDefaultForOrg', () => {
    it('usa el primer proyecto activo', async () => {
      const { svc, projects } = build();
      projects.findDefaultActiveWithConfigs.mockResolvedValue({
        id: 'p1',
        assistantConfigs: [{ id: 'c1' }],
      });
      expect(await svc.findDefaultForOrg('org')).toEqual({ id: 'c1' });
    });

    it('si no hay proyectos crea uno con el slug de la organización normalizado', async () => {
      const { svc, configs, projects, organizations } = build();
      projects.findDefaultActiveWithConfigs.mockResolvedValue(null);
      organizations.findNameAndSlug.mockResolvedValue({
        name: 'Muni',
        slug: 'Mi Muni!!',
      });
      projects.upsertBySlug.mockResolvedValue({ id: 'p9' });
      configs.findByProjectId.mockResolvedValue(null);

      await svc.findDefaultForOrg('org');

      expect(projects.upsertBySlug).toHaveBeenCalledWith(
        'org',
        'mi-muni',
        'Muni',
      );
    });

    it('sin slug de organización usa el id; si queda vacío, "default"', async () => {
      const { svc, configs, projects, organizations } = build();
      projects.findDefaultActiveWithConfigs.mockResolvedValue(null);
      organizations.findNameAndSlug.mockResolvedValue({
        name: 'X',
        slug: null,
      });
      projects.upsertBySlug.mockResolvedValue({ id: 'p9' });
      configs.findByProjectId.mockResolvedValue(null);
      await svc.findDefaultForOrg('ORG_1');
      expect(projects.upsertBySlug.mock.calls[0][1]).toBe('org-1');
      organizations.findNameAndSlug.mockResolvedValue({
        name: 'X',
        slug: '!!!',
      });
      await svc.findDefaultForOrg('org');
      expect(projects.upsertBySlug.mock.calls[1][1]).toBe('default');
    });

    it('404 si la organización no existe', async () => {
      const { svc, projects, organizations } = build();
      projects.findDefaultActiveWithConfigs.mockResolvedValue(null);
      organizations.findNameAndSlug.mockResolvedValue(null);
      await expect(svc.findDefaultForOrg('org')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
