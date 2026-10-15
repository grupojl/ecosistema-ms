// Strategies por ecosistema (ADR-019): registro, resolución con fallback y comportamiento de Generic/Welver/Manzana/Mexus.
import { ProjectStrategyRegistry } from '@/core/strategies/project-strategy.registry.js';
import { GenericStrategy } from '@/core/strategies/generic.strategy.js';
import { ProjectType } from '@/core/strategies/project-strategy.interface.js';
import { DEFAULT_ORG_PROFILE } from '@/core/strategies/project-context.interface.js';
import { WelverStrategy } from '@/modules/welver/welver.strategy.js';
import { ManzanaStrategy } from '@/modules/manzana/manzana.strategy.js';
import { MexusStrategy } from '@/modules/mexus/mexus.strategy.js';

const input = { ecosystemId: 'eco-1', organizationId: 'org-1' } as never;
const profile = (over: Record<string, unknown> = {}) => ({
  ...DEFAULT_ORG_PROFILE,
  organizationId: 'org-1',
  ecosystemId: 'eco-1',
  ...over,
});

describe('ProjectStrategyRegistry', () => {
  it('resuelve por tipo y cae a GENERIC con un tipo desconocido o ausente', () => {
    const registry = new ProjectStrategyRegistry();
    const generic = new GenericStrategy(registry);
    generic.onModuleInit();
    const welver = { getProjectType: () => ProjectType.WELVER } as never;
    registry.register(welver);

    expect(registry.get('eco', 'welver')).toBe(welver);
    expect(registry.get('eco', 'inexistente')).toBe(generic);
    expect(registry.get('eco', null)).toBe(generic);
    expect(registry.get('eco')).toBe(generic);
    expect(registry.listRegistered()).toEqual(
      expect.arrayContaining([ProjectType.GENERIC, ProjectType.WELVER]),
    );
  });

  it('registrar dos veces el mismo tipo sobreescribe (no duplica)', () => {
    const registry = new ProjectStrategyRegistry();
    const a = { getProjectType: () => ProjectType.WELVER } as never;
    const b = { getProjectType: () => ProjectType.WELVER } as never;
    registry.register(a);
    registry.register(b);
    expect(registry.get('eco', 'welver')).toBe(b);
    expect(registry.listRegistered()).toHaveLength(1);
  });
});

describe('GenericStrategy', () => {
  it('es el fallback: prompt neutro, perfil por defecto del tenant y after() no hace nada', async () => {
    const registry = new ProjectStrategyRegistry();
    const s = new GenericStrategy(registry);
    s.onModuleInit();
    expect(s.getProjectType()).toBe(ProjectType.GENERIC);
    const ctx = await s.enrichConversationContext(input);
    expect(ctx.defaultStage).toBe('INITIAL');
    expect(ctx.orgProfile).toMatchObject({
      organizationId: 'org-1',
      ecosystemId: 'eco-1',
    });
    await expect(
      s.afterConversationResult({} as never, ctx),
    ).resolves.toBeUndefined();
    expect(await s.resolveOrgProfile('eco-1', 'org-1')).toMatchObject({
      organizationId: 'org-1',
    });
  });
});

describe('WelverStrategy', () => {
  function build() {
    const registry = new ProjectStrategyRegistry();
    const orgConfig = { resolve: jest.fn().mockResolvedValue(profile()) };
    const assistantConfigs = {
      findEnabledModelForOrganization: jest.fn().mockResolvedValue(null),
    };
    const conversations = {
      updateStage: jest.fn().mockResolvedValue(undefined),
      countOpenWithAgent: jest.fn().mockResolvedValue(0),
    };
    const ecosystems = {
      findById: jest.fn().mockResolvedValue({
        name: 'Tienda Sol',
        config: { plan: 'growth', category: 'ropa', markets: ['AR'] },
      }),
    };
    const knowledge = {
      countActiveKnowledgeBases: jest.fn().mockResolvedValue(1),
    };
    const s = new WelverStrategy(
      registry,
      orgConfig as never,
      assistantConfigs as never,
      conversations as never,
      ecosystems as never,
      knowledge as never,
    );
    return {
      s,
      registry,
      orgConfig,
      assistantConfigs,
      conversations,
      ecosystems,
      knowledge,
    };
  }

  it('se registra al iniciar y declara su tipo', () => {
    const { s, registry } = build();
    s.onModuleInit();
    expect(s.getProjectType()).toBe(ProjectType.WELVER);
    expect(registry.get('eco', 'welver')).toBe(s);
  });

  it('enrich arma el prompt con los datos reales del comercio y usa el modelo de la config habilitada', async () => {
    const { s, assistantConfigs, orgConfig } = build();
    orgConfig.resolve.mockResolvedValue(
      profile({
        featureFlags: { ...DEFAULT_ORG_PROFILE.featureFlags, faqEnabled: true },
      }),
    );
    assistantConfigs.findEnabledModelForOrganization.mockResolvedValue({
      groqModel: 'otro-modelo',
    });
    const ctx = await s.enrichConversationContext(input);
    expect(ctx.systemPrompt).toContain('Tienda Sol');
    expect(ctx.preferredModel).toBe('otro-modelo');
    expect(ctx.useFaqFallback).toBe(true); // faq habilitada + hay catálogo
    expect(ctx.businessData).toMatchObject({
      storeName: 'Tienda Sol',
      merchantPlan: 'growth',
      hasProductCatalog: true,
      humanAgentsOnline: false,
    });
  });

  it('detecta agentes en línea y sin catálogo no usa el respaldo de FAQ', async () => {
    const { s, conversations, knowledge, orgConfig } = build();
    conversations.countOpenWithAgent.mockResolvedValue(2);
    knowledge.countActiveKnowledgeBases.mockResolvedValue(0);
    orgConfig.resolve.mockResolvedValue(
      profile({
        featureFlags: { ...DEFAULT_ORG_PROFILE.featureFlags, faqEnabled: true },
      }),
    );
    const ctx = await s.enrichConversationContext(input);
    expect(ctx.businessData).toMatchObject({
      hasProductCatalog: false,
      humanAgentsOnline: true,
    });
    expect(ctx.useFaqFallback).toBe(false);
  });

  it('NUNCA lanza: si el ecosistema o los repositories fallan devuelve datos por defecto', async () => {
    const { s, ecosystems } = build();
    ecosystems.findById.mockRejectedValue(new Error('db'));
    const ctx = await s.enrichConversationContext(input);
    expect(ctx.businessData).toMatchObject({
      storeName: 'Tu tienda',
      merchantPlan: 'starter',
    });
  });

  it('si orgConfig lanza, devuelve el contexto mínimo', async () => {
    const { s, orgConfig } = build();
    orgConfig.resolve.mockRejectedValue(new Error('boom'));
    const ctx = await s.enrichConversationContext(input);
    expect(ctx.systemPrompt).toBe('Eres un asistente amable.');
    expect(ctx.businessData).toEqual({});
  });

  it('after: cambia la etapa solo si no es INITIAL, siempre acotada a la organización', async () => {
    const { s, conversations } = build();
    await s.afterConversationResult(
      {
        conversationId: 'c1',
        organizationId: 'org-1',
        newStage: 'QUALIFYING',
        escalated: false,
      } as never,
      {} as never,
    );
    expect(conversations.updateStage).toHaveBeenCalledWith(
      'c1',
      'org-1',
      'QUALIFYING',
    );
    conversations.updateStage.mockClear();
    await s.afterConversationResult(
      {
        conversationId: 'c1',
        organizationId: 'org-1',
        newStage: 'INITIAL',
      } as never,
      {} as never,
    );
    expect(conversations.updateStage).not.toHaveBeenCalled();
  });

  it('after nunca lanza (ni siquiera si falla el cambio de etapa o hay escalación)', async () => {
    const { s, conversations } = build();
    conversations.updateStage.mockRejectedValue(new Error('etapa inválida'));
    await expect(
      s.afterConversationResult(
        {
          conversationId: 'c1',
          organizationId: 'o',
          newStage: 'HUMAN',
          escalated: true,
        } as never,
        {} as never,
      ),
    ).resolves.toBeUndefined();
  });

  it('resolveOrgProfile delega en la configuración de la organización', async () => {
    const { s, orgConfig } = build();
    await s.resolveOrgProfile('eco-1', 'org-1');
    expect(orgConfig.resolve).toHaveBeenCalledWith('eco-1', 'org-1');
  });
});

describe.each([
  ['Manzana', ManzanaStrategy, ProjectType.MANZANA, 'MANZANA'],
  ['Mexus', MexusStrategy, ProjectType.MEXUS, 'MEXUS'],
] as const)('%s (placeholder)', (_name, Strategy, type, marker) => {
  function build() {
    const registry = new ProjectStrategyRegistry();
    const orgConfig = { resolve: jest.fn().mockResolvedValue(profile()) };
    const s = new Strategy(registry, orgConfig as never);
    return { s, registry, orgConfig };
  }

  it('se registra y declara su tipo', () => {
    const { s, registry } = build();
    s.onModuleInit();
    expect(s.getProjectType()).toBe(type);
    expect(registry.get('eco', String(type))).toBe(s);
  });

  it('enrich usa el perfil de la organización y su prompt (todavía genérico: TODO de producto)', async () => {
    const { s, orgConfig } = build();
    const ctx = await s.enrichConversationContext(input);
    expect(orgConfig.resolve).toHaveBeenCalledWith('eco-1', 'org-1');
    expect(ctx.systemPrompt).toContain(marker);
    expect(ctx.defaultStage).toBe('INITIAL');
  });

  it('si la config falla degrada a un contexto mínimo (nunca lanza)', async () => {
    const { s, orgConfig } = build();
    orgConfig.resolve.mockRejectedValue(new Error('db'));
    const ctx = await s.enrichConversationContext(input);
    expect(ctx.systemPrompt).toBe('Eres un asistente amable.');
    expect(ctx.useFaqFallback).toBe(false);
  });

  it('after es no-op y resolveOrgProfile delega', async () => {
    const { s, orgConfig } = build();
    await expect(
      s.afterConversationResult({} as never, {} as never),
    ).resolves.toBeUndefined();
    await s.resolveOrgProfile('eco-1', 'org-1');
    expect(orgConfig.resolve).toHaveBeenCalledWith('eco-1', 'org-1');
  });
});
