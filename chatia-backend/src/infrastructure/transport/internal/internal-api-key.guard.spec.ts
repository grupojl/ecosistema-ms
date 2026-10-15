import { ForbiddenException } from '@nestjs/common';
import { InternalApiKeyGuard } from '@/infrastructure/transport/internal/internal-api-key.guard.js';

const ctx = (headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers, ip: '10.0.0.1' }) }),
  }) as never;

const guard = (env: Record<string, string | undefined>) =>
  new InternalApiKeyGuard({ get: (k: string) => env[k] } as never);

describe('InternalApiKeyGuard', () => {
  it('acepta la clave del contrato superadmin', () => {
    expect(
      guard({ INTERNAL_API_KEY: 'k'.repeat(20) }).canActivate(
        ctx({ 'x-internal-api-key': 'k'.repeat(20) }),
      ),
    ).toBe(true);
  });

  it('acepta la clave legacy x-api-key', () => {
    expect(
      guard({ CHAT_INTERNAL_API_KEY: 'legacy-key-123456' }).canActivate(
        ctx({ 'x-api-key': 'legacy-key-123456' }),
      ),
    ).toBe(true);
  });

  it('rechaza clave incorrecta o ausente', () => {
    const g = guard({ INTERNAL_API_KEY: 'k'.repeat(20) });
    expect(() => g.canActivate(ctx({ 'x-internal-api-key': 'otra' }))).toThrow(
      ForbiddenException,
    );
    expect(() => g.canActivate(ctx({}))).toThrow(ForbiddenException);
  });

  it('con la clave del servidor sin configurar rechaza todo, incluso un header vacío', () => {
    const g = guard({});
    expect(() => g.canActivate(ctx({ 'x-internal-api-key': '' }))).toThrow(
      ForbiddenException,
    );
    expect(() => g.canActivate(ctx({}))).toThrow(ForbiddenException);
  });
});
