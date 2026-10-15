// src/infrastructure/providers/llm.service.ts
//
// LLM con cadena de fallback: Groq → SiliconFlow (orden en LLM_PROVIDERS).
// Misma firma que GroqService.chat/chatJson para reemplazarlo sin tocar a los callers.
// Si toda la cadena cae lanza AllProvidersFailedError: el caller degrada (mensaje de
// reintento + alerta técnica), nunca escala a un humano.
import { Injectable } from '@nestjs/common';
import {
  ProviderChainService,
  type ChainStep,
} from '@/infrastructure/providers/provider-chain.service.js';
import { parseProviderOrder } from '@/infrastructure/providers/provider-order.js';
import {
  chatCompletion,
  resolveEndpoint,
  type OpenAiCompatName,
} from '@/infrastructure/providers/openai-compat.client.js';

const LLM_PROVIDER_NAMES = ['groq', 'siliconflow'] as const;
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_SF_MODEL = 'openai/gpt-oss-120b';

const CB_KEYS: Record<OpenAiCompatName, string> = {
  groq: 'groq-llm',
  siliconflow: 'siliconflow-llm',
};
// LLM es el componente más frágil — timeout alto, threshold bajo, recuperación lenta
const CB_OPTIONS = {
  timeout: 15_000,
  errorThreshold: 30,
  resetTimeout: 120_000,
};

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  /** Id de modelo de Groq. En otros proveedores se traduce (ver modelFor). */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LlmResponse {
  content: string;
  tokensUsed: number;
  model: string;
  provider: string;
}

@Injectable()
export class LlmService {
  constructor(private readonly chain: ProviderChainService) {}

  async chat(
    messages: LlmMessage[],
    options: LlmOptions = {},
  ): Promise<LlmResponse> {
    const { temperature = 0.7, maxTokens = 1024, jsonMode = false } = options;
    const order = parseProviderOrder(
      process.env['LLM_PROVIDERS'],
      LLM_PROVIDER_NAMES,
      LLM_PROVIDER_NAMES,
    );

    const steps: ChainStep<Omit<LlmResponse, 'provider'>>[] = order.map(
      (name) => {
        const endpoint = resolveEndpoint(name);
        const model = this.modelFor(name, options.model);
        return {
          provider: name,
          cbKey: CB_KEYS[name],
          enabled: Boolean(endpoint.apiKey),
          cb: CB_OPTIONS,
          run: () =>
            chatCompletion(endpoint, {
              model,
              messages,
              temperature,
              maxTokens,
              jsonMode,
              timeoutMs: CB_OPTIONS.timeout,
            }),
        };
      },
    );

    const { value, provider } = await this.chain.run('llm', steps);
    return { ...value, provider };
  }

  /** Shortcut para obtener JSON estructurado. */
  async chatJson<T>(
    messages: LlmMessage[],
    options: LlmOptions = {},
  ): Promise<T> {
    const response = await this.chat(messages, { ...options, jsonMode: true });
    try {
      return JSON.parse(response.content) as T;
    } catch {
      throw new Error(
        `${response.provider} devolvió JSON inválido: ${response.content.slice(0, 200)}`,
      );
    }
  }

  /** Groq usa el modelo pedido; SiliconFlow lo traduce a su equivalente (grande/chico). */
  private modelFor(
    provider: OpenAiCompatName,
    requested: string | undefined,
  ): string {
    if (provider === 'groq') return requested ?? DEFAULT_GROQ_MODEL;

    const large = process.env['SILICONFLOW_LLM_MODEL'] ?? DEFAULT_SF_MODEL;
    const small = process.env['SILICONFLOW_LLM_MODEL_SMALL'] ?? large;
    // "20b" como número completo: /20b/ a secas también coincidía con "120b" (modelo grande)
    return requested && /(?:^|[^0-9])20b/i.test(requested) ? small : large;
  }
}
