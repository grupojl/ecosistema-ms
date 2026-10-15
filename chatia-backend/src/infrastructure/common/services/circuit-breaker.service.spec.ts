import {
  CircuitBreakerService,
  CircuitOpenError,
} from '@/infrastructure/common/services/circuit-breaker.service.js';

describe('CircuitBreakerService', () => {
  let svc: CircuitBreakerService;

  beforeEach(() => {
    svc = new CircuitBreakerService();
  });
  afterEach(() => svc.onModuleDestroy());

  it('ejecuta la operación que recibe en CADA llamada (no repite la primera)', async () => {
    expect(await svc.execute('k', () => Promise.resolve(1))).toBe(1);
    expect(await svc.execute('k', () => Promise.resolve(2))).toBe(2);
  });

  it('propaga el error de la operación mientras el circuito está cerrado', async () => {
    await expect(
      svc.execute('k', () => Promise.reject(new Error('proveedor 500'))),
    ).rejects.toThrow('proveedor 500');
    expect(svc.healthOf('k')).toBe('closed');
  });

  it('abre el circuito tras errores sostenidos y responde CircuitOpenError sin llamar al proveedor', async () => {
    const options = {
      volumeThreshold: 2,
      errorThreshold: 50,
      resetTimeout: 60_000,
    };
    const failing = jest.fn().mockRejectedValue(new Error('caído'));

    for (let i = 0; i < 4; i++) {
      await svc.execute('groq', failing, options).catch(() => undefined);
    }

    expect(svc.healthOf('groq')).toBe('open');
    const calls = failing.mock.calls.length;
    await expect(svc.execute('groq', failing, options)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
    expect(failing.mock.calls.length).toBe(calls); // no se llamó al proveedor
  });

  it('cada clave tiene su propio circuito (un proveedor caído no abre a los demás)', async () => {
    const options = { volumeThreshold: 1, errorThreshold: 1 };
    for (let i = 0; i < 3; i++) {
      await svc
        .execute('a', () => Promise.reject(new Error('x')), options)
        .catch(() => undefined);
    }
    expect(await svc.execute('b', () => Promise.resolve('ok'))).toBe('ok');
    expect(svc.healthOf('b')).toBe('closed');
  });

  it('getAll resume el estado de todos los breakers y healthOf devuelve unknown si no existe', async () => {
    await svc.execute('uno', () => Promise.resolve(1));
    expect(await svc.getAll()).toEqual({ uno: 'CLOSED' });
    expect(svc.healthOf('nunca')).toBe('unknown');
  });

  it('onModuleDestroy apaga los breakers', async () => {
    await svc.execute('uno', () => Promise.resolve(1));
    svc.onModuleDestroy();
    expect(await svc.getAll()).toEqual({});
  });
});
