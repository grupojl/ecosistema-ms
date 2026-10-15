import { LlmService } from '@/infrastructure/providers/llm.service.js';
import {
  AllProvidersFailedError,
  ProviderChainService,
} from '@/infrastructure/providers/provider-chain.service.js';
import { CircuitBreakerService } from '@/infrastructure/common/services/circuit-breaker.service.js';

const okResponse = (content: string): Response =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { total_tokens: 7 },
    }),
    { status: 200 },
  );

describe('LlmService', () => {
  let breaker: CircuitBreakerService;
  let llm: LlmService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    breaker = new CircuitBreakerService();
    llm = new LlmService(new ProviderChainService(breaker));
    process.env['GROQ_API_KEY'] = 'gsk_test';
    process.env['SILICONFLOW_API_KEY'] = 'sf_test';
    delete process.env['LLM_PROVIDERS'];
    delete process.env['SILICONFLOW_LLM_MODEL'];
    delete process.env['SILICONFLOW_LLM_MODEL_SMALL'];
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    breaker.onModuleDestroy();
    delete process.env['GROQ_API_KEY'];
    delete process.env['SILICONFLOW_API_KEY'];
  });

  const messages = [{ role: 'user' as const, content: 'hola' }];
  const urlOf = (call: unknown[]): string => String(call[0]);

  it('responde con Groq cuando está sano', async () => {
    fetchMock.mockResolvedValueOnce(okResponse('hola!'));
    const res = await llm.chat(messages, { model: 'openai/gpt-oss-120b' });
    expect(res).toMatchObject({
      content: 'hola!',
      provider: 'groq',
      tokensUsed: 7,
    });
    expect(urlOf(fetchMock.mock.calls[0]!)).toContain('api.groq.com');
  });

  it('si Groq da 500, responde SiliconFlow con su propia clave', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(okResponse('desde siliconflow'));
    const res = await llm.chat(messages);
    expect(res).toMatchObject({
      content: 'desde siliconflow',
      provider: 'siliconflow',
    });
    expect(urlOf(fetchMock.mock.calls[1]!)).toContain('siliconflow');
    expect((fetchMock.mock.calls[1]![1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer sf_test',
    });
  });

  it('sin clave de Groq va directo a SiliconFlow', async () => {
    delete process.env['GROQ_API_KEY'];
    fetchMock.mockResolvedValueOnce(okResponse('x'));
    const res = await llm.chat(messages);
    expect(res.provider).toBe('siliconflow');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('LLM_PROVIDERS cambia el orden de la cadena', async () => {
    process.env['LLM_PROVIDERS'] = 'siliconflow,groq';
    fetchMock.mockResolvedValueOnce(okResponse('x'));
    expect((await llm.chat(messages)).provider).toBe('siliconflow');
    delete process.env['LLM_PROVIDERS'];
  });

  it('traduce el modelo chico (20b) al modelo chico de SiliconFlow y el resto al grande', async () => {
    process.env['LLM_PROVIDERS'] = 'siliconflow';
    process.env['SILICONFLOW_LLM_MODEL'] = 'org/grande';
    process.env['SILICONFLOW_LLM_MODEL_SMALL'] = 'org/chico';
    fetchMock.mockImplementation(() => Promise.resolve(okResponse('x')));

    await llm.chat(messages, { model: 'openai/gpt-oss-20b' });
    await llm.chat(messages, { model: 'openai/gpt-oss-120b' });

    const bodies = fetchMock.mock.calls.map(
      (c) =>
        JSON.parse(String((c[1] as RequestInit).body)) as { model: string },
    );
    expect(bodies.map((b) => b.model)).toEqual(['org/chico', 'org/grande']);
    delete process.env['LLM_PROVIDERS'];
  });

  it('todos caídos → AllProvidersFailedError', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('down', { status: 503 })),
    );
    await expect(llm.chat(messages)).rejects.toBeInstanceOf(
      AllProvidersFailedError,
    );
  });

  it('respuesta vacía cuenta como fallo y pasa al siguiente', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '' } }] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(okResponse('ok'));
    expect((await llm.chat(messages)).provider).toBe('siliconflow');
  });

  it('chatJson parsea JSON y falla claro si el modelo devuelve basura', async () => {
    fetchMock.mockResolvedValueOnce(okResponse('{"intent":"greeting"}'));
    await expect(llm.chatJson<{ intent: string }>(messages)).resolves.toEqual({
      intent: 'greeting',
    });

    fetchMock.mockResolvedValueOnce(okResponse('no es json'));
    await expect(llm.chatJson(messages)).rejects.toThrow(/JSON inválido/);
  });

  it('chatJson pide response_format json_object', async () => {
    fetchMock.mockResolvedValueOnce(okResponse('{}'));
    await llm.chatJson(messages);
    const body = JSON.parse(
      String((fetchMock.mock.calls[0]![1] as RequestInit).body),
    ) as { response_format: unknown };
    expect(body.response_format).toEqual({ type: 'json_object' });
  });
});
