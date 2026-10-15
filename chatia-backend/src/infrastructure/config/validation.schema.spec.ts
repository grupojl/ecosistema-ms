import { validateEnv } from '@/infrastructure/config/validation.schema.js';

const base = { NODE_ENV: 'development', DATABASE_URL: 'postgresql://x' };

const prodOk = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://x',
  REDIS_ENABLED: 'true',
  ALLOWED_ORIGINS: 'https://dashboard.example.com',
  WIDGET_SESSION_SECRET: 'w'.repeat(32),
  PLATFORM_ADMIN_KEY: 'p'.repeat(16),
  INTERNAL_API_KEY: 'i'.repeat(16),
  META_APP_SECRET: 'meta-secret',
  CHANNEL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  FIREBASE_PROJECT_ID: 'proj',
  FIREBASE_CLIENT_EMAIL: 'sa@proj.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: 'key',
};

describe('validateEnv', () => {
  it('NODE_ENV es obligatorio (antes tenía default "development" y dejaba abierto el bypass)', () => {
    expect(() => validateEnv({ DATABASE_URL: 'postgresql://x' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('en desarrollo solo exige lo básico', () => {
    expect(validateEnv(base).NODE_ENV).toBe('development');
  });

  it('producción con todo configurado arranca', () => {
    expect(validateEnv(prodOk).NODE_ENV).toBe('production');
  });

  it.each([
    ['WIDGET_SESSION_SECRET', undefined, 'WIDGET_SESSION_SECRET'],
    ['WIDGET_SESSION_SECRET', 'corto', 'WIDGET_SESSION_SECRET'],
    ['PLATFORM_ADMIN_KEY', undefined, 'PLATFORM_ADMIN_KEY'],
    ['META_APP_SECRET', undefined, 'META_APP_SECRET'],
    ['CHANNEL_TOKEN_ENCRYPTION_KEY', undefined, 'CHANNEL_TOKEN_ENCRYPTION_KEY'],
    [
      'CHANNEL_TOKEN_ENCRYPTION_KEY',
      'demasiado-corta',
      'CHANNEL_TOKEN_ENCRYPTION_KEY',
    ],
    ['FIREBASE_PRIVATE_KEY', undefined, 'FIREBASE_PROJECT_ID'],
    ['ALLOWED_ORIGINS', undefined, 'ALLOWED_ORIGINS'],
    ['REDIS_ENABLED', 'false', 'REDIS_ENABLED'],
  ])('producción falla si %s = %s', (key, value, reported) => {
    const env: Record<string, unknown> = { ...prodOk, [key]: value };
    expect(() => validateEnv(env)).toThrow(new RegExp(reported));
  });

  it('producción falla sin ninguna clave interna', () => {
    const { INTERNAL_API_KEY: _omit, ...rest } = prodOk;
    expect(() => validateEnv(rest)).toThrow(/INTERNAL_API_KEY/);
  });

  it('producción prohíbe ALLOW_DEV_AUTH y SWAGGER_ENABLED', () => {
    expect(() => validateEnv({ ...prodOk, ALLOW_DEV_AUTH: 'true' })).toThrow(
      /ALLOW_DEV_AUTH/,
    );
    expect(() => validateEnv({ ...prodOk, SWAGGER_ENABLED: 'true' })).toThrow(
      /SWAGGER_ENABLED/,
    );
  });

  it('lista TODOS los problemas juntos, no de a uno', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production', DATABASE_URL: 'x' }),
    ).toThrow(
      /META_APP_SECRET[\s\S]*FIREBASE_PROJECT_ID|FIREBASE_PROJECT_ID[\s\S]*META_APP_SECRET/,
    );
  });
});
