import {
  appConfig,
  dbConfig,
  firebaseConfig,
  groqConfig,
  metaConfig,
  redisConfig,
} from '@/infrastructure/config/app.config.js';

const KEYS = [
  'NODE_ENV',
  'PORT',
  'ALLOWED_ORIGINS',
  'APP_URL',
  'DATABASE_URL',
  'GROQ_API_KEY',
  'REDIS_URL',
  'META_APP_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];

describe('configuración de la app (registerAs)', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('app: valores por defecto de desarrollo', () => {
    expect(appConfig()).toEqual({
      nodeEnv: 'development',
      port: 3010,
      allowedOrigins: [],
      appUrl: 'http://localhost:3010',
    });
  });

  it('app: lee el entorno, el puerto es numérico y los orígenes ignoran vacíos', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PORT'] = '8080';
    process.env['ALLOWED_ORIGINS'] = 'https://a.com,,https://b.com,';
    process.env['APP_URL'] = 'https://api.ejemplo.com';
    expect(appConfig()).toEqual({
      nodeEnv: 'production',
      port: 8080,
      allowedOrigins: ['https://a.com', 'https://b.com'],
      appUrl: 'https://api.ejemplo.com',
    });
  });

  it('redis: usa REDIS_URL o localhost', () => {
    expect(redisConfig().url).toBe('redis://localhost:6379');
    process.env['REDIS_URL'] = 'redis://r:1';
    expect(redisConfig().url).toBe('redis://r:1');
  });

  it('db, groq y meta pasan el valor del entorno (undefined si no está)', () => {
    expect(dbConfig().url).toBeUndefined();
    expect(groqConfig().apiKey).toBeUndefined();
    expect(metaConfig().appSecret).toBeUndefined();
    process.env['DATABASE_URL'] = 'postgresql://x';
    process.env['GROQ_API_KEY'] = 'g';
    process.env['META_APP_SECRET'] = 'm';
    expect(dbConfig().url).toBe('postgresql://x');
    expect(groqConfig().apiKey).toBe('g');
    expect(metaConfig().appSecret).toBe('m');
  });

  it('firebase: la clave privada recupera sus saltos de línea escapados (\\n)', () => {
    expect(firebaseConfig().privateKey).toBeUndefined();
    process.env['FIREBASE_PROJECT_ID'] = 'p';
    process.env['FIREBASE_CLIENT_EMAIL'] = 'e@x';
    process.env['FIREBASE_PRIVATE_KEY'] = 'linea1\\nlinea2';
    expect(firebaseConfig()).toEqual({
      projectId: 'p',
      clientEmail: 'e@x',
      privateKey: 'linea1\nlinea2',
    });
  });
});
