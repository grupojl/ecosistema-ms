import { ConflictException, NotFoundException } from '@nestjs/common';
import { WidgetConfigService } from '@/core/widget/widget-config.service.js';

const project = (over: Record<string, unknown> = {}) => ({
  id: 'prj-1',
  organization: { ecosystemId: 'eco-1' },
  assistantConfigs: [{ id: 'cfg-1', isEnabled: true, personaName: 'Sofi' }],
  ...over,
});

describe('WidgetConfigService (config pública del widget)', () => {
  const projects = { findActiveBySlugForWidget: jest.fn() };
  const svc = new WidgetConfigService(projects as never);

  beforeEach(() => jest.clearAllMocks());

  it('devuelve la config del asistente con el id del proyecto y el ecosistema', async () => {
    projects.findActiveBySlugForWidget.mockResolvedValue([project()]);
    const res = await svc.resolve('tienda', 'org-1');
    expect(projects.findActiveBySlugForWidget).toHaveBeenCalledWith(
      'tienda',
      'org-1',
    );
    expect(res).toMatchObject({
      id: 'cfg-1',
      projectId: 'prj-1',
      ecosystemId: 'eco-1',
      personaName: 'Sofi',
    });
  });

  it('404 si el proyecto no existe', async () => {
    projects.findActiveBySlugForWidget.mockResolvedValue([]);
    await expect(svc.resolve('nada')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409 si el slug existe en más de una organización y no se indicó ?org=', async () => {
    projects.findActiveBySlugForWidget.mockResolvedValue([
      project(),
      project({ id: 'prj-2' }),
    ]);
    await expect(svc.resolve('tienda')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('404 si el proyecto no tiene asistente configurado', async () => {
    projects.findActiveBySlugForWidget.mockResolvedValue([
      project({ assistantConfigs: [] }),
    ]);
    await expect(svc.resolve('tienda')).rejects.toThrow(
      'no tiene asistente configurado',
    );
  });

  it('404 (sin revelar que existe) si el asistente está deshabilitado', async () => {
    projects.findActiveBySlugForWidget.mockResolvedValue([
      project({ assistantConfigs: [{ id: 'cfg-1', isEnabled: false }] }),
    ]);
    await expect(svc.resolve('tienda')).rejects.toThrow('no está disponible');
  });
});
