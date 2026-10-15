import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  type ArgumentsHost,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { z } from 'zod';
import { AllExceptionsFilter } from '@/infrastructure/common/filters/all-exceptions.filter.js';
import { HttpExceptionFilter } from '@/infrastructure/common/filters/http-exception.filter.js';
import { ZodExceptionFilter } from '@/infrastructure/common/filters/zod-exception.filter.js';
import { ZodValidationPipe } from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import { RolesGuard } from '@/infrastructure/common/guards/roles.guard.js';
import { WritePermissionGuard } from '@/infrastructure/common/guards/write-permission.guard.js';
import { TenantThrottlerGuard } from '@/infrastructure/common/guards/tenant-throttler.guard.js';
import { LoggingInterceptor } from '@/infrastructure/common/interceptors/logging.interceptor.js';
import { ConversationsAnalyticsInterceptor } from '@/core/conversations/conversations-analytics.interceptor.js';

const schema = z.object({ name: z.string().min(1), age: z.number() });
const zodError = () => schema.safeParse({ name: '', age: 'x' }).error!;

function httpHost(req: Record<string, unknown> = {}) {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    statusCode: 200,
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('filtros de excepciones', () => {
  it('ZodExceptionFilter responde 400 con los errores agrupados por campo', () => {
    const { host, res } = httpHost();
    new ZodExceptionFilter().catch(zodError(), host);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0] as {
      errors: Record<string, string[]>;
    };
    expect(Object.keys(body.errors).sort()).toEqual(['age', 'name']);
  });

  it('AllExceptionsFilter: Zod → 400, HttpException → su status, otro → 500 sin filtrar detalles', () => {
    const f = new AllExceptionsFilter();

    const a = httpHost();
    f.catch(zodError(), a.host);
    expect(a.res.status).toHaveBeenCalledWith(400);

    const b = httpHost();
    f.catch(new NotFoundException('nada'), b.host);
    expect(b.res.status).toHaveBeenCalledWith(404);

    const c = httpHost();
    f.catch(new Error('password=secreto en el stack'), c.host);
    expect(c.res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(c.res.json.mock.calls[0][0])).not.toContain(
      'secreto',
    );
  });

  it('HttpExceptionFilter incluye path y timestamp y toma el message de la respuesta', () => {
    const { host, res } = httpHost({ url: '/x', method: 'GET' });
    new HttpExceptionFilter().catch(
      new BadRequestException({ message: 'dato inválido' }),
      host,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      success: false,
      statusCode: 400,
      message: 'dato inválido',
      path: '/x',
    });
  });

  it('HttpExceptionFilter con status 5xx y respuesta string', () => {
    const { host, res } = httpHost({ url: '/y', method: 'POST' });
    new HttpExceptionFilter().catch(new HttpException('caído', 503), host);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].message).toBe('caído');
  });
});

describe('ZodValidationPipe', () => {
  const meta = { type: 'body' } as never;

  it('devuelve el dato parseado (aplica defaults y descarta campos no declarados)', () => {
    const out = new ZodValidationPipe(schema).transform(
      { name: 'Ana', age: 3, extra: true },
      meta,
    );
    expect(out).toEqual({ name: 'Ana', age: 3 });
  });

  it('lanza 400 con errores por campo', () => {
    expect(() =>
      new ZodValidationPipe(schema).transform({ name: '' }, meta),
    ).toThrow(BadRequestException);
  });

  it('sin schema deja pasar el valor', () => {
    expect(new ZodValidationPipe().transform('x', meta)).toBe('x');
  });
});

function ctxWith(req: unknown, handler: object = {}, cls: object = {}) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guardFor = (required: string[] | undefined) =>
    new RolesGuard({ getAllAndOverride: () => required } as never);

  it('sin roles requeridos deja pasar', () => {
    expect(guardFor(undefined).canActivate(ctxWith({}))).toBe(true);
    expect(guardFor([]).canActivate(ctxWith({}))).toBe(true);
  });

  it('respeta la jerarquía VIEWER < MEMBER < ADMIN < OWNER', () => {
    expect(
      guardFor(['ADMIN']).canActivate(ctxWith({ tenant: { role: 'owner' } })),
    ).toBe(true);
    expect(() =>
      guardFor(['ADMIN']).canActivate(ctxWith({ tenant: { role: 'MEMBER' } })),
    ).toThrow(ForbiddenException);
  });

  it('sin contexto de tenant o con rol desconocido niega', () => {
    expect(() => guardFor(['MEMBER']).canActivate(ctxWith({}))).toThrow(
      'Sin contexto de tenant',
    );
    expect(() =>
      guardFor(['MEMBER']).canActivate(ctxWith({ tenant: { role: 'ROOT' } })),
    ).toThrow(ForbiddenException);
  });

  it('con varios roles alcanza el menor', () => {
    expect(
      guardFor(['OWNER', 'MEMBER']).canActivate(
        ctxWith({ tenant: { role: 'MEMBER' } }),
      ),
    ).toBe(true);
  });
});

describe('WritePermissionGuard', () => {
  const g = new WritePermissionGuard();
  it('exige tenant con canWrite', () => {
    expect(g.canActivate(ctxWith({ tenant: { canWrite: true } }))).toBe(true);
    expect(() =>
      g.canActivate(ctxWith({ tenant: { canWrite: false } })),
    ).toThrow(ForbiddenException);
    expect(() => g.canActivate(ctxWith({}))).toThrow('Sin contexto de tenant');
  });
});

describe('TenantThrottlerGuard', () => {
  // Se invocan los métodos protegidos sin construir el guard completo
  const proto = TenantThrottlerGuard.prototype as unknown as {
    getTracker(req: unknown): Promise<string>;
    shouldSkip(ctx: ExecutionContext): Promise<boolean>;
  };

  it('prioriza proyecto > organización > IP', async () => {
    expect(
      await proto.getTracker({
        headers: { 'x-project-id': 'p', 'x-organization-id': 'o' },
        ip: '1.1.1.1',
      }),
    ).toBe('proj:p');
    expect(
      await proto.getTracker({
        headers: { 'x-organization-id': 'o' },
        ip: '1.1.1.1',
      }),
    ).toBe('org:o');
    expect(await proto.getTracker({ headers: {}, ip: '1.1.1.1' })).toBe(
      '1.1.1.1',
    );
    expect(await proto.getTracker({})).toBe('unknown');
  });

  it('no limita los webhooks', async () => {
    expect(
      await proto.shouldSkip(ctxWith({ path: '/api/v1/webhooks/x' })),
    ).toBe(true);
    expect(await proto.shouldSkip(ctxWith({ path: '/api/v1/contacts' }))).toBe(
      false,
    );
  });
});

describe('LoggingInterceptor', () => {
  const run = (next: CallHandler, url = '/a?hub.verify_token=SECRETO') => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    return new LoggingInterceptor().intercept(ctx, next);
  };

  it('no altera la respuesta ni el error', async () => {
    expect(await lastValueFrom(run({ handle: () => of('ok') }))).toBe('ok');
    await expect(
      lastValueFrom(run({ handle: () => throwError(() => new Error('boom')) })),
    ).rejects.toThrow('boom');
  });
});

describe('ConversationsAnalyticsInterceptor', () => {
  const analytics = {
    trackConversationCreated: jest.fn(),
    trackConversationResolved: jest.fn(),
    trackConversationAssigned: jest.fn(),
  };
  const run = async (
    method: string,
    url: string,
    result: unknown,
    user: object | null = { ecosystemId: 'e', organizationId: 'o' },
  ) => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ method, url, body: {}, user: user ?? undefined }),
      }),
    } as unknown as ExecutionContext;
    const out = await lastValueFrom(
      new ConversationsAnalyticsInterceptor(analytics as never).intercept(ctx, {
        handle: () => of(result),
      }),
    );
    return out;
  };
  beforeEach(() => jest.clearAllMocks());

  it('POST /conversations → created; resolve/takeover → su evento', async () => {
    await run('POST', '/api/v1/conversations', { id: 'c1', contactId: 'k' });
    expect(analytics.trackConversationCreated).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'c1', channel: 'UNKNOWN' }),
    );
    await run('PATCH', '/conversations/c1/resolve', { id: 'c1' });
    expect(analytics.trackConversationResolved).toHaveBeenCalled();
    await run('PATCH', '/conversations/c1/takeover', {
      id: 'c1',
      assignedAgentId: 'a1',
    });
    expect(analytics.trackConversationAssigned).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'a1' }),
    );
  });

  it('sin usuario/tenant no emite y no altera el resultado', async () => {
    const r = await run('POST', '/conversations', { id: 'c1' }, null);
    expect(r).toEqual({ id: 'c1' });
    expect(analytics.trackConversationCreated).not.toHaveBeenCalled();
  });

  it('un fallo de analytics nunca rompe la respuesta', async () => {
    analytics.trackConversationCreated.mockImplementation(() => {
      throw new Error('analytics caído');
    });
    expect(await run('POST', '/conversations', { id: 'c1' })).toEqual({
      id: 'c1',
    });
  });
});
