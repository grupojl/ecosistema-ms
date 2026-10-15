import { GroqService } from '@/infrastructure/groq/groq.service.js';

describe('GroqService (legacy, lo usa el motor LangGraph)', () => {
  const fetchMock = jest.fn();
  const svc = new GroqService();
  const msgs = [{ role: 'user' as const, content: 'hola' }];
  const ok = (content: string, tokens = 12) => ({
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content } }],
        usage: { total_tokens: tokens },
      }),
  });

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env['GROQ_API_KEY'] = 'gsk-test';
  });
  afterEach(() => delete process.env['GROQ_API_KEY']);

  it('sin GROQ_API_KEY falla antes de llamar a la red', async () => {
    delete process.env['GROQ_API_KEY'];
    await expect(svc.chat(msgs)).rejects.toThrow('GROQ_API_KEY no configurada');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('manda el modelo, la temperatura y el token por header; devuelve contenido y tokens', async () => {
    fetchMock.mockResolvedValue(ok('respuesta'));
    const res = await svc.chat(msgs, { temperature: 0.2, maxTokens: 50 });
    expect(res).toEqual({
      content: 'respuesta',
      tokensUsed: 12,
      model: 'openai/gpt-oss-120b',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('api.groq.com');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer gsk-test',
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      temperature: 0.2,
      max_tokens: 50,
    });
  });

  it('error HTTP → lanza con el status (sin filtrar el cuerpo al caller)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('rate limit'),
    });
    await expect(svc.chat(msgs)).rejects.toThrow('Groq API error: 429');
  });

  it('respuesta vacía → contenido vacío y 0 tokens', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    expect(await svc.chat(msgs)).toMatchObject({ content: '', tokensUsed: 0 });
  });

  it('chatJson pide JSON mode y parsea; un JSON inválido da error claro', async () => {
    fetchMock.mockResolvedValue(ok('{"intent":"saludo"}'));
    expect(await svc.chatJson<{ intent: string }>(msgs)).toEqual({
      intent: 'saludo',
    });
    expect(
      JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)
        .response_format,
    ).toEqual({ type: 'json_object' });

    fetchMock.mockResolvedValue(ok('no es json'));
    await expect(svc.chatJson(msgs)).rejects.toThrow('JSON inválido');
  });
});
