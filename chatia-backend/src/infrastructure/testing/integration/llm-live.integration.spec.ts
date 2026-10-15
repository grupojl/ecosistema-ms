// Prueba contra el proveedor REAL de LLM (Groq). Gasta unos pocos tokens: es OPT-IN.
//   TEST_LLM_LIVE=1 GROQ_API_KEY=... pnpm test:integration -- llm-live
// Sin esas variables se saltea sola (CI y desarrollo normal no llaman a internet).
// Lo que los mocks no ven: el formato real de la respuesta, el contador de tokens, el modo JSON y qué pasa con una clave inválida.
import { LlmService } from '@/infrastructure/providers/llm.service.js';
import {
  AllProvidersFailedError,
  ProviderChainService,
} from '@/infrastructure/providers/provider-chain.service.js';
import { CircuitBreakerService } from '@/infrastructure/common/services/circuit-breaker.service.js';

const LIVE =
  process.env['TEST_LLM_LIVE'] === '1' && !!process.env['GROQ_API_KEY'];
const describeLive = LIVE ? describe : describe.skip;

describeLive('LLM real (Groq)', () => {
  let breaker: CircuitBreakerService;
  let llm: LlmService;
  const realKey = process.env['GROQ_API_KEY'];
  const realOrder = process.env['LLM_PROVIDERS'];

  beforeEach(() => {
    breaker = new CircuitBreakerService();
    llm = new LlmService(new ProviderChainService(breaker));
    process.env['GROQ_API_KEY'] = realKey;
    process.env['LLM_PROVIDERS'] = 'groq';
  });

  afterAll(() => {
    process.env['GROQ_API_KEY'] = realKey;
    if (realOrder === undefined) delete process.env['LLM_PROVIDERS'];
    else process.env['LLM_PROVIDERS'] = realOrder;
    breaker.onModuleDestroy();
  });

  it('responde según el system prompt y reporta proveedor, modelo y tokens', async () => {
    const r = await llm.chat(
      [
        {
          role: 'system',
          content: 'Respondé únicamente con la palabra PONG, en mayúsculas.',
        },
        { role: 'user', content: 'ping' },
      ],
      { temperature: 0, maxTokens: 400 },
    );
    expect(r.provider).toBe('groq');
    expect(r.content.toUpperCase()).toContain('PONG');
    expect(r.tokensUsed).toBeGreaterThan(0);
    expect(r.model).toBeTruthy();
  }, 30_000);

  it('modo JSON devuelve un objeto parseable', async () => {
    const r = await llm.chatJson<{ ok: boolean }>(
      [
        {
          role: 'system',
          content: 'Devolvé exactamente este JSON y nada más: {"ok": true}',
        },
        { role: 'user', content: 'dale' },
      ],
      { temperature: 0, maxTokens: 400 },
    );
    expect(r.ok).toBe(true);
  }, 30_000);

  it('clave inválida: falla rápido con AllProvidersFailedError y NO filtra la clave en el error', async () => {
    process.env['GROQ_API_KEY'] = 'gsk_clave_invalida_de_prueba';
    const t0 = Date.now();
    const err = await llm
      .chat([{ role: 'user', content: 'hola' }], { maxTokens: 20 })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(err).toBeInstanceOf(AllProvidersFailedError);
    expect(Date.now() - t0).toBeLessThan(15_000);
    expect((err as Error).message).not.toContain(
      'gsk_clave_invalida_de_prueba',
    );
    expect((err as Error).message).not.toContain(realKey as string);
  }, 30_000);
});
