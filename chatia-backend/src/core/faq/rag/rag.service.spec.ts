import { RagService } from '@/core/faq/rag/rag.service.js';

function build() {
  const faqQuery = { search: jest.fn() };
  const llm = { chat: jest.fn() };
  return {
    svc: new RagService(faqQuery as never, llm as never),
    faqQuery,
    llm,
  };
}

const chunk = (n: number) => ({
  chunkId: `c${n}`,
  documentId: `d${n}`,
  documentTitle: `Doc ${n}`,
  content: `contenido ${n} ${'x'.repeat(300)}`,
  score: 1 - n / 10,
});

describe('RagService', () => {
  it('sin fragmentos relevantes no llama al LLM y lo dice claramente', async () => {
    const { svc, faqQuery, llm } = build();
    faqQuery.search.mockResolvedValue([]);
    const res = await svc.answer('kb-1', '¿horario?');
    expect(res.answer).toContain('No encontré información');
    expect(res.sources).toEqual([]);
    expect(llm.chat).not.toHaveBeenCalled();
  });

  it('arma el contexto numerado, aísla por organización y devuelve las fuentes', async () => {
    const { svc, faqQuery, llm } = build();
    faqQuery.search.mockResolvedValue([chunk(1), chunk(2)]);
    llm.chat.mockResolvedValue({
      content: 'Atendemos de 8 a 14 [1]',
      tokensUsed: 80,
      model: 'gpt-oss-120b',
    });

    const res = await svc.answer('kb-1', '¿horario?', {
      organizationId: 'org-1',
      topK: 3,
    });

    expect(faqQuery.search).toHaveBeenCalledWith(
      'kb-1',
      '¿horario?',
      3,
      'org-1',
    );
    const [messages, opts] = llm.chat.mock.calls[0] as [
      Array<{ role: string; content: string }>,
      Record<string, unknown>,
    ];
    expect(messages[0]!.content).toContain('ÚNICAMENTE en el contexto');
    expect(messages[1]!.content).toContain('[1] Doc 1');
    expect(messages[1]!.content).toContain('[2] Doc 2');
    expect(messages[1]!.content).toContain('Pregunta: ¿horario?');
    expect(opts).toMatchObject({ temperature: 0.3, maxTokens: 1024 });
    expect(res.answer).toBe('Atendemos de 8 a 14 [1]');
    expect(res.tokensUsed).toBe(80);
    expect(res.modelUsed).toBe('gpt-oss-120b');
    expect(res.sources).toHaveLength(2);
    expect(res.sources[0]!.excerpt).toHaveLength(200); // la fuente se acota
  });

  it('respeta modelo, temperatura y tokens pedidos', async () => {
    const { svc, faqQuery, llm } = build();
    faqQuery.search.mockResolvedValue([chunk(1)]);
    llm.chat.mockResolvedValue({ content: 'ok', tokensUsed: 1, model: 'm' });
    await svc.answer('kb', 'q', {
      groqModel: 'otro',
      temperature: 0.9,
      maxTokens: 50,
    });
    expect(llm.chat.mock.calls[0]![1]).toEqual({
      model: 'otro',
      temperature: 0.9,
      maxTokens: 50,
    });
    expect(faqQuery.search).toHaveBeenCalledWith('kb', 'q', 5, undefined);
  });
});
