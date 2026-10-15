// Variables de entorno para el test de arranque. Se importa PRIMERO: los módulos leen process.env al cargarse.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@127.0.0.1:1/none',
  REDIS_ENABLED: 'false',
  REDIS_URL: 'redis://127.0.0.1:1',
  WIDGET_SESSION_SECRET: 'w'.repeat(40),
});
