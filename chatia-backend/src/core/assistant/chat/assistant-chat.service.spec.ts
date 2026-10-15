import { AssistantChatService } from '@/core/assistant/chat/assistant-chat.service.js';
import { AllProvidersFailedError } from '@/infrastructure/providers/provider-chain.service.js';

const mockConfig = {
  id: 'config-1',
  projectId: 'proj-1',
  organizationId: 'org-1',
  ecosystemId: 'eco-1',
  personaName: 'Sofía',
  systemPrompt: 'Sos un asistente de prueba.',
  groqModel: 'openai/gpt-oss-120b',
  temperature: 0.7,
  maxTokens: 1024,
  contextWindow: 10,
  welcomeMessage: null,
  fallbackMessage: 'No puedo responder en este momento.',
  useFaqFallback: false,
  faqKbId: null,
  isEnabled: true,
};

const mockSession = { id: 'session-1', organizationId: 'org-1' };

const projectCtx = (overrides: Record<string, unknown> = {}) => ({
  systemPrompt: '',
  preferredModel: 'openai/gpt-oss-120b',
  useFaqFallback: true,
  orgProfile: { featureFlags: { aiAssistantEnabled: true, faqEnabled: true } },
  ...overrides,
});

describe('AssistantChatService', () => {
  const ecosystems = { findById: jest.fn() };
  const llm = { chat: jest.fn() };
  const events = { emitToAgent: jest.fn() };
  const configSvc = {
    findByProjectSlug: jest.fn(),
    findDefaultForOrg: jest.fn(),
  };
  const sessionSvc = {
    getOrCreate: jest.fn(),
    appendMessage: jest.fn(),
    getHistory: jest.fn(),
  };
  const strategy = {
    enrichConversationContext: jest.fn(),
    afterConversationResult: jest.fn(),
  };
  const registry = { get: jest.fn() };
  const rag = { answer: jest.fn() };
  let service: AssistantChatService;

  const input = {
    projectSlug: 'shopbot',
    organizationId: 'org-1',
    ecosystemId: 'eco-1',
    userId: 'user-123',
    message: 'Hola',
    channel: 'api',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['GROQ_MODEL'];
    ecosystems.findById.mockResolvedValue({
      config: { projectType: 'welver' },
    });
    configSvc.findByProjectSlug.mockResolvedValue(mockConfig);
    sessionSvc.getOrCreate.mockResolvedValue(mockSession);
    sessionSvc.getHistory.mockResolvedValue([]);
    sessionSvc.appendMessage.mockResolvedValue({});
    strategy.enrichConversationContext.mockResolvedValue(projectCtx());
    registry.get.mockReturnValue(strategy);
    llm.chat.mockResolvedValue({
      content: 'Hola, soy Sofía.',
      tokensUsed: 42,
      model: 'openai/gpt-oss-120b',
      provider: 'groq',
    });

    service = new AssistantChatService(
      ecosystems as never,
      llm as never,
      events as never,
      configSvc as never,
      sessionSvc as never,
      registry as never,
      rag,
    );
  });

  it('devuelve la respuesta del LLM y la guarda en la sesión', async () => {
    const result = await service.chat(input);
    expect(result).toMatchObject({
      response: 'Hola, soy Sofía.',
      tokensUsed: 42,
      sessionId: 'session-1',
      usedFaqFallback: false,
    });
    expect(sessionSvc.appendMessage).toHaveBeenCalledWith(
      'session-1',
      'assistant',
      'Hola, soy Sofía.',
    );
  });

  it('crea/recupera la sesión del usuario y respeta contextWindow', async () => {
    await service.chat(input);
    expect(sessionSvc.getOrCreate).toHaveBeenCalledWith(
      'config-1',
      'org-1',
      'user-123',
      'api',
    );
    expect(sessionSvc.getHistory).toHaveBeenCalledWith('session-1', 10);
  });

  it('asistente deshabilitado → fallbackMessage sin llamar al LLM', async () => {
    configSvc.findByProjectSlug.mockResolvedValue({
      ...mockConfig,
      isEnabled: false,
      fallbackMessage: 'Fuera de servicio',
    });
    const result = await service.chat(input);
    expect(result.response).toBe('Fuera de servicio');
    expect(llm.chat).not.toHaveBeenCalled();
  });

  it('feature flag apagado en la org → no usa el LLM', async () => {
    strategy.enrichConversationContext.mockResolvedValue(
      projectCtx({
        orgProfile: {
          featureFlags: { aiAssistantEnabled: false, faqEnabled: false },
        },
      }),
    );
    const result = await service.chat(input);
    expect(result.response).toContain('no está disponible');
    expect(llm.chat).not.toHaveBeenCalled();
  });

  it('GROQ_MODEL (env) manda sobre la config del proyecto', async () => {
    process.env['GROQ_MODEL'] = 'openai/gpt-oss-20b';
    await service.chat(input);
    expect(llm.chat).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ model: 'openai/gpt-oss-20b' }),
    );
  });

  it('si caen TODOS los proveedores pide reintentar, NO escala a un humano y lo registra', async () => {
    llm.chat.mockRejectedValue(
      new AllProvidersFailedError('llm', [
        { provider: 'groq', reason: 'timeout' },
        { provider: 'siliconflow', reason: 'no configurado' },
      ]),
    );
    const result = await service.chat(input);
    expect(result.modelUsed).toBe('fallback');
    expect(result.response).toContain('Probá de nuevo');
    expect(result.response).not.toContain('agente');
    expect(events.emitToAgent).not.toHaveBeenCalledWith(
      expect.anything(),
      'assistant:escalate',
      expect.anything(),
    );
    expect(strategy.afterConversationResult).toHaveBeenCalledWith(
      expect.objectContaining({
        escalated: false,
        metadata: expect.objectContaining({ providerFailed: true }),
      }),
      expect.anything(),
    );
  });

  it('un error cualquiera del LLM usa el fallbackMessage de la organización', async () => {
    llm.chat.mockRejectedValue(new Error('boom'));
    const result = await service.chat(input);
    expect(result.response).toBe('No puedo responder en este momento.');
  });

  it('baja confianza + FAQ habilitada → responde con RAG y marca usedFaqFallback', async () => {
    configSvc.findByProjectSlug.mockResolvedValue({
      ...mockConfig,
      useFaqFallback: true,
      faqKbId: 'kb-1',
    });
    llm.chat.mockResolvedValue({
      content: 'No tengo información sobre eso.',
      tokensUsed: 10,
      model: 'm',
      provider: 'groq',
    });
    rag.answer.mockResolvedValue({
      answer: 'Según la FAQ: ...',
      sources: [{ documentId: 'd1' }],
    });
    const result = await service.chat({
      ...input,
      message: '¿Precio del depto?',
    });
    expect(result.usedFaqFallback).toBe(true);
    expect(result.response).toBe('Según la FAQ: ...');
    expect(result.faqSources).toHaveLength(1);
  });

  it('si el RAG falla, conserva la respuesta del LLM', async () => {
    configSvc.findByProjectSlug.mockResolvedValue({
      ...mockConfig,
      useFaqFallback: true,
      faqKbId: 'kb-1',
    });
    llm.chat.mockResolvedValue({
      content: 'No sé.',
      tokensUsed: 1,
      model: 'm',
      provider: 'groq',
    });
    rag.answer.mockRejectedValue(new Error('rag down'));
    const result = await service.chat(input);
    expect(result.usedFaqFallback).toBe(false);
    expect(result.response).toBe('No sé.');
  });

  it('sin projectSlug usa el proyecto por defecto de la organización', async () => {
    configSvc.findDefaultForOrg.mockResolvedValue(mockConfig);
    await service.chat({ ...input, projectSlug: undefined });
    expect(configSvc.findDefaultForOrg).toHaveBeenCalledWith('org-1');
  });
});
