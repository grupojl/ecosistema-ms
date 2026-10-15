import {
  corsFor,
  parseAllowedOrigins,
} from '@/infrastructure/security/cors.js';

describe('CORS por ruta', () => {
  const allowed = ['https://dashboard.example.com'];

  it('el widget acepta cualquier origen y NUNCA credenciales', () => {
    expect(corsFor('/api/v1/widget/tramites/chat', allowed)).toEqual({
      origin: true,
      credentials: false,
    });
    expect(corsFor('/api/v1/widget/tramites/snippet.js', allowed)).toEqual({
      origin: true,
      credentials: false,
    });
  });

  it('el resto de la API solo acepta los orígenes configurados, con credenciales', () => {
    expect(corsFor('/api/v1/contacts', allowed)).toEqual({
      origin: allowed,
      credentials: true,
    });
  });

  it('sin ALLOWED_ORIGINS no se permite ningún origen (no cae a "*")', () => {
    expect(corsFor('/api/v1/contacts', parseAllowedOrigins(undefined))).toEqual(
      { origin: [], credentials: true },
    );
  });

  it('parseAllowedOrigins recorta espacios y descarta vacíos', () => {
    expect(parseAllowedOrigins(' https://a.com , ,https://b.com ')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('una ruta que solo se parece a la del widget no hereda su CORS abierto', () => {
    expect(corsFor('/api/v1/widgets-admin', allowed).credentials).toBe(true);
    expect(corsFor('/api/v1/widgetx/foo', allowed).credentials).toBe(true);
  });
});
