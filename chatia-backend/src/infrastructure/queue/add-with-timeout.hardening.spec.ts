// El tope por defecto, los valores inválidos de QUEUE_ADD_TIMEOUT_MS y la limpieza del temporizador.
import { ServiceUnavailableException } from '@nestjs/common';
import { addWithTimeout } from '@/infrastructure/queue/add-with-timeout.js';

const never = () => new Promise<never>(() => undefined);

describe('addWithTimeout — tope y temporizador', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete process.env['QUEUE_ADD_TIMEOUT_MS'];
  });
  afterEach(() => {
    jest.useRealTimers();
    delete process.env['QUEUE_ADD_TIMEOUT_MS'];
  });

  const settle = (p: Promise<unknown>) => {
    const state = { done: false, err: undefined as unknown };
    p.then(
      () => (state.done = true),
      (e: unknown) => {
        state.done = true;
        state.err = e;
      },
    );
    return state;
  };

  it('sin configuración el tope es de 3 segundos: ni un milisegundo antes', async () => {
    const s = settle(addWithTimeout(never, 'q'));
    await jest.advanceTimersByTimeAsync(2_999);
    expect(s.done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(s.done).toBe(true);
    expect(s.err).toBeInstanceOf(ServiceUnavailableException);
  });

  it('QUEUE_ADD_TIMEOUT_MS válido se respeta', async () => {
    process.env['QUEUE_ADD_TIMEOUT_MS'] = '100';
    const s = settle(addWithTimeout(never, 'q'));
    await jest.advanceTimersByTimeAsync(99);
    expect(s.done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(s.done).toBe(true);
  });

  it.each(['0', '-5', 'abc', '', 'NaN', 'Infinity'])(
    'un valor inválido (%p) NO desactiva el tope: vuelve a 3 segundos',
    async (bad) => {
      process.env['QUEUE_ADD_TIMEOUT_MS'] = bad;
      const s = settle(addWithTimeout(never, 'q'));
      await jest.advanceTimersByTimeAsync(2_999);
      expect(s.done).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(s.done).toBe(true);
      expect(s.err).toBeInstanceOf(ServiceUnavailableException);
    },
  );

  it('al resolver a tiempo no deja temporizadores pendientes', async () => {
    await expect(addWithTimeout(() => Promise.resolve(1), 'q')).resolves.toBe(
      1,
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('al fallar la cola tampoco deja temporizadores pendientes', async () => {
    await expect(
      addWithTimeout(() => Promise.reject(new Error('x')), 'q'),
    ).rejects.toThrow('x');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('el mensaje del 503 nombra la cola', async () => {
    const s = settle(addWithTimeout(never, 'outgoing-message'));
    await jest.advanceTimersByTimeAsync(3_000);
    expect((s.err as Error).message).toContain('outgoing-message');
  });
});
