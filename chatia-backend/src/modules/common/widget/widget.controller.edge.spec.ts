// Bordes del widget: historial vacío, mensaje de bienvenida por defecto y URL de la API.
import type { Request, Response } from 'express';
import { WidgetController } from '@/modules/common/widget/widget.controller.js';
import { WidgetConfigService } from '@/core/widget/widget-config.service.js';
import { WidgetSessionService } from '@/core/widget/widget-session.service.js';
import { RateLimitService } from '@/infrastructure/security/rate-limit.service.js';

const config = (over: Record<string, unknown> = {}) => ({
  id: 'cfg-1',
  organizationId: 'org-1',
  isEnabled: true,
  personaName: 'Sofía',
  welcomeMessage: null as string | null,
  systemPrompt: 'SECRETO',
  groqModel: 'm',
  allowedOrigins: [] as string[],
  ...over,
});
const projectWith = (cfg: ReturnType<typeof config>) => ({
  id: 'proj-1',
  slug: 'tramites',
  isActive: true,
  organizationId: 'org-1',
  organization: { ecosystemId: 'eco-1' },
  assistantConfigs: [cfg],
});

describe('WidgetController — bordes', () => {
  const projects = { findActiveBySlugForWidget: jest.fn() };
  const sessions = { findByUser: jest.fn() };
  const req = { ip: '203.0.113.9', headers: {} } as unknown as Request;
  let rateLimit: RateLimitService;
  let controller: WidgetController;
  const savedApp = process.env['APP_URL'];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['WIDGET_SESSION_SECRET'] = 'w'.repeat(40);
    delete process.env['REDIS_ENABLED'];
    delete process.env['APP_URL'];
    projects.findActiveBySlugForWidget.mockResolvedValue([
      projectWith(config()),
    ]);
    rateLimit = new RateLimitService();
    controller = new WidgetController(
      new WidgetConfigService(projects as never),
      { chat: jest.fn() } as never,
      sessions as never,
      rateLimit,
      new WidgetSessionService(),
    );
  });
  afterEach(() => {
    rateLimit.onModuleDestroy();
    delete process.env['WIDGET_SESSION_SECRET'];
    if (savedApp === undefined) delete process.env['APP_URL'];
    else process.env['APP_URL'] = savedApp;
  });

  it('historial: una sesión sin conversaciones previas devuelve data null (no rompe ni inventa)', async () => {
    sessions.findByUser.mockResolvedValue(null);
    const { token } = await controller.createSession('tramites', req, 'org-1');
    await expect(
      controller.getSession('tramites', token, req, 'org-1'),
    ).resolves.toEqual({ success: true, data: null });
  });

  it('snippet: sin welcomeMessage usa el saludo por defecto y apunta a APP_URL (o localhost)', async () => {
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;
    await controller.getSnippet('tramites', res, 'org-1');
    const js = (res.send as jest.Mock).mock.calls[0][0] as string;
    expect(js).toContain('¡Hola! ¿En qué puedo ayudarte?');
    expect(js).toContain('http://localhost:3010/api/v1');

    process.env['APP_URL'] = 'https://chat.ejemplo.com';
    const res2 = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;
    await controller.getSnippet('tramites', res2, 'org-1');
    expect((res2.send as jest.Mock).mock.calls[0][0]).toContain(
      'https://chat.ejemplo.com/api/v1',
    );
    expect(res2.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/javascript; charset=utf-8',
    );
  });
});
