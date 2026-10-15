// Bordes de AssistantChatService: valores por defecto, precedencias (modelo, prompt) y mensajes de respaldo.
import { AssistantChatService } from '@/core/assistant/chat/assistant-chat.service.js';

const config = (over: Record<string, unknown> = {}) => ({
  id: 'config-1',
  personaName: 'Sofía',
  systemPrompt: 'Prompt del proyecto.',
  groqModel: 'modelo-del-proyecto',
  temperature: 0.5,
  maxTokens: 300,
  contextWindow: 10,
  fallbackMessage: null as string | null,
  faqKbId: null,
  isEnabled: true,
  ...over,
});
const ctx = (over: Record<string, unknown> = {}) => ({
  systemPrompt: '',
  preferredModel: 'modelo-de-la-strategy',
  useFaqFallback: false,
  orgProfile: { featureFlags: { aiAssistantEnabled: true, faqEnabled: false } },
  ...over,
});

describe('AssistantChatService — bordes', () => {
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
  let service: AssistantChatService;
  const input = {
    organizationId: 'org-1',
    ecosystemId: 'eco-1',
    userId: 'u1',
    message: 'Hola',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['GROQ_MODEL'];
    ecosystems.findById.mockResolvedValue({
      config: { projectType: 'welver' },
    });
    configSvc.findDefaultForOrg.mockResolvedValue(config());
    sessionSvc.getOrCreate.mockResolvedValue({ id: 's1' });
    sessionSvc.getHistory.mockResolvedValue([]);
    sessionSvc.appendMessage.mockResolvedValue({});
    strategy.enrichConversationContext.mockResolvedValue(ctx());
    registry.get.mockReturnValue(strategy);
    llm.chat.mockResolvedValue({
      content: 'respuesta',
      tokensUsed: 5,
      model: 'm',
      provider: 'groq',
    });
    service = new AssistantChatService(
      ecosystems as never,
      llm as never,
      events as never,
      configSvc as never,
      sessionSvc as never,
      registry as never,
    );
  });

  it('sin canal explícito usa "api" tanto para la strategy como para la sesión', async () => {
    await service.chat(input);
    expect(strategy.enrichConversationContext).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'api' }),
    );
    expect(sessionSvc.getOrCreate).toHaveBeenCalledWith(
      'config-1',
      'org-1',
      'u1',
      'api',
    );
  });

  it.each([
    ['ecosistema inexistente', null],
    ['ecosistema sin config', { config: null }],
    ['projectType que no es string', { config: { projectType: 42 } }],
  ])(
    '%s → la strategy se pide sin tipo (null), no revienta',
    async (_n, eco) => {
      ecosystems.findById.mockResolvedValue(eco);
      await service.chat(input);
      expect(registry.get).toHaveBeenCalledWith('eco-1', null);
    },
  );

  it('asistente deshabilitado SIN mensaje propio → texto genérico, sin LLM ni sesión', async () => {
    configSvc.findDefaultForOrg.mockResolvedValue(
      config({ isEnabled: false, fallbackMessage: null }),
    );
    const r = await service.chat(input);
    expect(r.response).toBe('El asistente no está disponible.');
    expect(llm.chat).not.toHaveBeenCalled();
    expect(sessionSvc.getOrCreate).not.toHaveBeenCalled();
  });

  it('error del LLM SIN mensaje de respaldo de la organización → pide repetir', async () => {
    llm.chat.mockRejectedValue(new Error('boom'));
    const r = await service.chat(input);
    expect(r.response).toBe('¡Disculpá! Tuve un problema. ¿Podés repetir?');
    expect(r.tokensUsed).toBe(0);
  });

  describe('precedencia del modelo', () => {
    it('config del proyecto > strategy', async () => {
      await service.chat(input);
      expect(llm.chat.mock.calls[0]?.[1]).toMatchObject({
        model: 'modelo-del-proyecto',
        temperature: 0.5,
        maxTokens: 300,
      });
    });

    it('sin modelo en el proyecto cae al de la strategy', async () => {
      configSvc.findDefaultForOrg.mockResolvedValue(config({ groqModel: '' }));
      await service.chat(input);
      expect(llm.chat.mock.calls[0]?.[1]).toMatchObject({
        model: 'modelo-de-la-strategy',
      });
    });

    it('GROQ_MODEL (env) manda sobre todo', async () => {
      process.env['GROQ_MODEL'] = 'modelo-del-env';
      await service.chat(input);
      expect(llm.chat.mock.calls[0]?.[1]).toMatchObject({
        model: 'modelo-del-env',
      });
    });
  });

  describe('prompt de sistema', () => {
    const systemOf = () =>
      (
        llm.chat.mock.calls[0]?.[0] as Array<{ role: string; content: string }>
      )[0];

    it('el de la strategy (personalizado por org) tiene prioridad', async () => {
      strategy.enrichConversationContext.mockResolvedValue(
        ctx({ systemPrompt: 'Prompt de la organización' }),
      );
      await service.chat(input);
      expect(systemOf()).toEqual({
        role: 'system',
        content: 'Prompt de la organización',
      });
    });

    it('si la strategy no define uno, se arma con el del proyecto y el nombre del asistente', async () => {
      await service.chat(input);
      expect(systemOf()?.content).toBe(
        'Prompt del proyecto.\n\nTu nombre es Sofía.',
      );
    });

    it('sin prompt en ningún lado usa el genérico amigable', async () => {
      configSvc.findDefaultForOrg.mockResolvedValue(
        config({ systemPrompt: '' }),
      );
      await service.chat(input);
      expect(systemOf()?.content).toBe(
        'Sos un asistente virtual amigable.\n\nTu nombre es Sofía.',
      );
    });
  });

  it('el historial se envía sin el último turno (el mensaje actual va aparte, sin duplicarse)', async () => {
    sessionSvc.getHistory.mockResolvedValue([
      { role: 'user', content: 'uno' },
      { role: 'assistant', content: 'dos' },
      { role: 'user', content: 'Hola' }, // el recién agregado
    ]);
    await service.chat(input);
    const msgs = llm.chat.mock.calls[0]?.[0] as Array<{
      role: string;
      content: string;
    }>;
    expect(msgs.map((m) => `${m.role}:${m.content}`)).toEqual([
      'system:Prompt del proyecto.\n\nTu nombre es Sofía.',
      'user:uno',
      'assistant:dos',
      'user:Hola',
    ]);
  });
});
