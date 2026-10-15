import {
  AllProvidersFailedError,
  ProviderChainService,
  type ChainStep,
} from '@/infrastructure/providers/provider-chain.service.js';
import { CircuitBreakerService } from '@/infrastructure/common/services/circuit-breaker.service.js';

const step = (
  provider: string,
  run: () => Promise<string>,
  enabled = true,
): ChainStep<string> => ({
  provider,
  cbKey: `${provider}-test`,
  enabled,
  run,
});

describe('ProviderChainService', () => {
  let breaker: CircuitBreakerService;
  let chain: ProviderChainService;

  beforeEach(() => {
    breaker = new CircuitBreakerService();
    chain = new ProviderChainService(breaker);
  });

  afterEach(() => breaker.onModuleDestroy());

  it('usa el primer proveedor si responde', async () => {
    const second = jest.fn().mockResolvedValue('b');
    const res = await chain.run('llm', [
      step('a', () => Promise.resolve('A')),
      step('b', second),
    ]);
    expect(res).toEqual({ value: 'A', provider: 'a' });
    expect(second).not.toHaveBeenCalled();
  });

  it('si el primero falla, responde el siguiente (fallback)', async () => {
    const res = await chain.run('llm', [
      step('a', () => Promise.reject(new Error('503'))),
      step('b', () => Promise.resolve('B')),
    ]);
    expect(res).toEqual({ value: 'B', provider: 'b' });
  });

  it('saltea proveedores sin configurar y no los invoca', async () => {
    const skipped = jest.fn();
    const res = await chain.run('tts', [
      step('a', skipped as never, false),
      step('b', () => Promise.resolve('B')),
    ]);
    expect(res.provider).toBe('b');
    expect(skipped).not.toHaveBeenCalled();
  });

  it('cadena agotada → AllProvidersFailedError con el motivo de cada proveedor', async () => {
    const err = await chain
      .run('llm', [
        step('a', () => Promise.reject(new Error('timeout'))),
        step('b', () => Promise.resolve('x'), false),
      ])
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AllProvidersFailedError);
    const failed = err as AllProvidersFailedError;
    expect(failed.capability).toBe('llm');
    expect(failed.failures).toEqual([
      { provider: 'a', reason: 'timeout' },
      { provider: 'b', reason: 'no configurado' },
    ]);
    expect(failed.message).toContain('timeout');
  });

  it('cadena vacía o toda deshabilitada también lanza el error (no queda colgada)', async () => {
    await expect(chain.run('stt', [])).rejects.toBeInstanceOf(
      AllProvidersFailedError,
    );
    await expect(
      chain.run('stt', [step('a', () => Promise.resolve('x'), false)]),
    ).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it('un breaker abierto en el primario manda el tráfico al secundario sin volver a llamarlo', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('down'));
    const primary: ChainStep<string> = {
      provider: 'a',
      cbKey: 'a-open',
      enabled: true,
      run: failing,
      cb: { errorThreshold: 1, volumeThreshold: 1, resetTimeout: 60_000 },
    };
    const secondary = step('b', () => Promise.resolve('B'));

    await chain.run('llm', [primary, secondary]); // abre el breaker
    const callsAfterOpen = failing.mock.calls.length;
    const res = await chain.run('llm', [primary, secondary]);

    expect(res.provider).toBe('b');
    expect(failing.mock.calls.length).toBe(callsAfterOpen); // ya no se llama al caído
    expect(breaker.healthOf('a-open')).toBe('open');
  });
});
