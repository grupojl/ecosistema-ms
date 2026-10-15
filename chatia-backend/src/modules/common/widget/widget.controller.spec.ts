import {
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  WidgetController,
  toJsString,
} from '@/modules/common/widget/widget.controller.js';
import { WidgetConfigService } from '@/core/widget/widget-config.service.js';
import { WidgetSessionService } from '@/core/widget/widget-session.service.js';
import { RateLimitService } from '@/infrastructure/security/rate-limit.service.js';

const project = {
  id: 'proj-1',
  slug: 'tramites',
  isActive: true,
  organizationId: 'org-1',
  organization: { ecosystemId: 'eco-1' },
  assistantConfigs: [
    {
      id: 'cfg-1',
      organizationId: 'org-1',
      isEnabled: true,
      personaName: 'Sofía',
      welcomeMessage: 'Hola',
      systemPrompt: 'SECRETO',
      groqModel: 'openai/gpt-oss-120b',
      allowedOrigins: [] as string[],
    },
  ],
};

describe('WidgetController', () => {
  const projects = { findActiveBySlugForWidget: jest.fn() };
  const chat = { chat: jest.fn() };
  const sessions = { findByUser: jest.fn() };
  let rateLimit: RateLimitService;
  let widgetSessions: WidgetSessionService;
  let controller: WidgetController;
  const req = { ip: '203.0.113.7', headers: {} } as unknown as Request;
  const reqFrom = (origin?: string): Request =>
    ({
      ip: '203.0.113.7',
      headers: origin ? { origin } : {},
    }) as unknown as Request;
  const withOrigins = (allowedOrigins: string[]) => {
    projects.findActiveBySlugForWidget.mockResolvedValue([
      {
        ...project,
        assistantConfigs: [{ ...project.assistantConfigs[0]!, allowedOrigins }],
      },
    ]);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['WIDGET_SESSION_SECRET'] = 'w'.repeat(40);
    process.env['NODE_ENV'] = 'test';
    delete process.env['REDIS_ENABLED'];
    projects.findActiveBySlugForWidget.mockResolvedValue([project]);
    chat.chat.mockResolvedValue({ response: 'ok', sessionId: 's' });
    rateLimit = new RateLimitService();
    widgetSessions = new WidgetSessionService();
    controller = new WidgetController(
      new WidgetConfigService(projects as never),
      chat as never,
      sessions as never,
      rateLimit,
      widgetSessions,
    );
  });

  afterEach(async () => {
    rateLimit.onModuleDestroy();
    delete process.env['WIDGET_SESSION_SECRET'];
    delete process.env['WIDGET_CHAT_PER_MIN_SESSION'];
    delete process.env['WIDGET_DAILY_QUOTA'];
  });

  const newToken = async (): Promise<string> =>
    (await controller.createSession('tramites', req, 'org-1')).token;

  it('la config pública NO expone systemPrompt ni el modelo', async () => {
    const cfg = await controller.getConfig('tramites', 'org-1');
    expect(cfg).toEqual({
      personaName: 'Sofía',
      welcomeMessage: 'Hola',
      isEnabled: true,
    });
    expect(JSON.stringify(cfg)).not.toContain('SECRETO');
  });

  it('chat sin token → 401 y NO llama al LLM', async () => {
    await expect(
      controller.chat('tramites', undefined, req, { message: 'hola' }, 'org-1'),
    ).rejects.toThrow(UnauthorizedException);
    expect(chat.chat).not.toHaveBeenCalled();
  });

  it('chat con token válido usa un userId derivado de la sesión firmada (no del cliente)', async () => {
    const token = await newToken();
    await controller.chat('tramites', token, req, { message: 'hola' }, 'org-1');
    expect(chat.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        ecosystemId: 'eco-1',
        channel: 'widget',
        userId: expect.stringMatching(/^widget:[0-9a-f-]{36}$/),
      }),
    );
  });

  it('un token de otro proyecto no sirve', async () => {
    const other = widgetSessions.issue('otro', 'org-1').token;
    await expect(
      controller.chat('tramites', other, req, { message: 'hola' }, 'org-1'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('límite por sesión: el mensaje N+1 devuelve 429 antes de gastar LLM', async () => {
    process.env['WIDGET_CHAT_PER_MIN_SESSION'] = '2';
    const token = await newToken();
    await controller.chat('tramites', token, req, { message: '1' }, 'org-1');
    await controller.chat('tramites', token, req, { message: '2' }, 'org-1');
    const err = await controller
      .chat('tramites', token, req, { message: '3' }, 'org-1')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(chat.chat).toHaveBeenCalledTimes(2);
  });

  it('cuota diaria del proyecto: 429 con mensaje claro', async () => {
    process.env['WIDGET_DAILY_QUOTA'] = '1';
    const t1 = await newToken();
    const t2 = await newToken();
    await controller.chat('tramites', t1, req, { message: 'a' }, 'org-1');
    const err = await controller
      .chat('tramites', t2, req, { message: 'b' }, 'org-1')
      .catch((e: unknown) => e);
    expect((err as HttpException).getStatus()).toBe(429);
    expect(JSON.stringify((err as HttpException).getResponse())).toContain(
      'límite diario',
    );
  });

  it('el historial solo se lee con el token de la propia sesión', async () => {
    sessions.findByUser.mockResolvedValue({
      history: [{ role: 'user', content: 'hola' }],
      lastMessageAt: null,
    });
    const token = await newToken();
    const res = await controller.getSession('tramites', token, req, 'org-1');
    expect(res.data?.history).toHaveLength(1);
    expect(sessions.findByUser).toHaveBeenCalledWith(
      'cfg-1',
      'org-1',
      expect.stringMatching(/^widget:/),
    );
    await expect(
      controller.getSession('tramites', undefined, req, 'org-1'),
    ).rejects.toThrow(UnauthorizedException);
  });

  describe('allowedOrigins del proyecto', () => {
    it('lista vacía = cualquier origen (comportamiento por defecto)', async () => {
      withOrigins([]);
      await expect(
        controller.createSession(
          'tramites',
          reqFrom('https://cualquiera.com'),
          'org-1',
        ),
      ).resolves.toHaveProperty('token');
    });

    it('con lista: el origen permitido pasa y el resto recibe 403 en sesión, chat e historial', async () => {
      withOrigins(['https://municipio.gob.ar']);
      const token = (
        await controller.createSession(
          'tramites',
          reqFrom('https://municipio.gob.ar'),
          'org-1',
        )
      ).token;

      await expect(
        controller.createSession(
          'tramites',
          reqFrom('https://evil.com'),
          'org-1',
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.chat(
          'tramites',
          token,
          reqFrom('https://evil.com'),
          { message: 'x' },
          'org-1',
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.getSession(
          'tramites',
          token,
          reqFrom('https://evil.com'),
          'org-1',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(chat.chat).not.toHaveBeenCalled();
    });

    it('con lista y sin cabecera Origin → 403 (scripts sin navegador)', async () => {
      withOrigins(['https://municipio.gob.ar']);
      await expect(
        controller.createSession('tramites', reqFrom(), 'org-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  it('slug repetido en varias organizaciones sin ?org → 409 (no mezcla tenants)', async () => {
    projects.findActiveBySlugForWidget.mockResolvedValue([
      project,
      { ...project, id: 'proj-2', organizationId: 'org-2' },
    ]);
    await expect(controller.getConfig('tramites')).rejects.toThrow(
      ConflictException,
    );
  });

  it('proyecto inexistente → 404', async () => {
    projects.findActiveBySlugForWidget.mockResolvedValue([]);
    await expect(controller.getConfig('nada')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('el snippet escapa valores hostiles y no incluye la config privada', async () => {
    projects.findActiveBySlugForWidget.mockResolvedValue([
      {
        ...project,
        assistantConfigs: [
          {
            ...project.assistantConfigs[0]!,
            personaName: "</script><script>alert(1)</script>'\\",
            welcomeMessage: 'a\nb',
          },
        ],
      },
    ]);
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;
    await controller.getSnippet('tramites', res, 'org-1');
    const js = (res.send as jest.Mock).mock.calls[0][0] as string;
    expect(js).not.toContain('</script>');
    expect(js).not.toContain('SECRETO');
    expect(() => new Function(js)).not.toThrow(); // JS válido: el valor hostil no rompe la sintaxis
  });
});

describe('toJsString', () => {
  it('neutraliza < > y separadores de línea Unicode', () => {
    const out = toJsString(`</script>${String.fromCharCode(0x2028)}`);
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain(String.fromCharCode(0x2028));
  });
});
