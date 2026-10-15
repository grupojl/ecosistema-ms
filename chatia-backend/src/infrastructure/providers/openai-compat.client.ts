// src/infrastructure/providers/openai-compat.client.ts
//
// Cliente mínimo para APIs compatibles con OpenAI: Groq y SiliconFlow comparten
// /chat/completions, /audio/transcriptions y /embeddings. Las claves y URLs se
// leen del entorno en cada llamada (las configura el operador, no el código).

export type OpenAiCompatName = 'groq' | 'siliconflow';

export interface OpenAiCompatEndpoint {
  name: OpenAiCompatName;
  baseUrl: string;
  apiKey: string | undefined;
}

export type OpenAiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAiContentPart[];
}

export interface ChatCompletionRequest {
  model: string;
  messages: OpenAiMessage[];
  temperature: number;
  maxTokens: number;
  jsonMode?: boolean;
  timeoutMs: number;
}

export interface ChatCompletionResult {
  content: string;
  tokensUsed: number;
  model: string;
}

export function resolveEndpoint(name: OpenAiCompatName): OpenAiCompatEndpoint {
  if (name === 'groq') {
    return {
      name,
      baseUrl: process.env['GROQ_BASE_URL'] ?? 'https://api.groq.com/openai/v1',
      apiKey: process.env['GROQ_API_KEY'],
    };
  }
  return {
    name,
    baseUrl:
      process.env['SILICONFLOW_BASE_URL'] ?? 'https://api.siliconflow.com/v1',
    apiKey: process.env['SILICONFLOW_API_KEY'],
  };
}

async function failOnError(
  endpoint: OpenAiCompatEndpoint,
  path: string,
  res: Response,
): Promise<void> {
  if (res.ok) return;
  const detail = (await res.text()).slice(0, 300);
  throw new Error(`${endpoint.name} ${path} ${res.status}: ${detail}`);
}

function requireKey(endpoint: OpenAiCompatEndpoint): string {
  if (!endpoint.apiKey)
    throw new Error(`${endpoint.name}: API key no configurada`);
  return endpoint.apiKey;
}

export async function chatCompletion(
  endpoint: OpenAiCompatEndpoint,
  req: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature,
    max_tokens: req.maxTokens,
  };
  if (req.jsonMode) body['response_format'] = { type: 'json_object' };

  const res = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireKey(endpoint)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(req.timeoutMs),
  });
  await failOnError(endpoint, '/chat/completions', res);

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${endpoint.name}: respuesta vacía`);

  return {
    content,
    tokensUsed: data.usage?.total_tokens ?? 0,
    model: req.model,
  };
}

export interface TranscriptionRequest {
  model: string;
  audio: ArrayBuffer;
  filename: string;
  mimeType: string;
  language?: string;
  timeoutMs: number;
}

export async function transcribeAudio(
  endpoint: OpenAiCompatEndpoint,
  req: TranscriptionRequest,
): Promise<string> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([req.audio], { type: req.mimeType }),
    req.filename,
  );
  form.append('model', req.model);
  if (req.language) form.append('language', req.language);

  const res = await fetch(`${endpoint.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${requireKey(endpoint)}` },
    body: form,
    signal: AbortSignal.timeout(req.timeoutMs),
  });
  await failOnError(endpoint, '/audio/transcriptions', res);

  const data = (await res.json()) as { text?: string };
  const text = data.text?.trim();
  if (!text) throw new Error(`${endpoint.name}: transcripción vacía`);
  return text;
}

/** Embeddings de uno o varios textos en una sola llamada. Devuelve los vectores en el MISMO orden de entrada. */
export async function createEmbeddings(
  endpoint: OpenAiCompatEndpoint,
  req: { model: string; inputs: string[]; timeoutMs: number },
): Promise<number[][]> {
  const res = await fetch(`${endpoint.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireKey(endpoint)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: req.model,
      input: req.inputs,
      encoding_format: 'float',
    }),
    signal: AbortSignal.timeout(req.timeoutMs),
  });
  await failOnError(endpoint, '/embeddings', res);

  const data = (await res.json()) as {
    data?: Array<{ index?: number; embedding?: number[] }>;
  };
  const rows = [...(data.data ?? [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
  if (
    rows.length !== req.inputs.length ||
    rows.some((r) => !r.embedding || r.embedding.length === 0)
  ) {
    throw new Error(
      `${endpoint.name}: respuesta de embeddings incompleta (${rows.length}/${req.inputs.length})`,
    );
  }
  return rows.map((r) => r.embedding as number[]);
}

export async function createEmbedding(
  endpoint: OpenAiCompatEndpoint,
  req: { model: string; input: string; timeoutMs: number },
): Promise<number[]> {
  const [embedding] = await createEmbeddings(endpoint, {
    model: req.model,
    inputs: [req.input],
    timeoutMs: req.timeoutMs,
  });
  return embedding;
}
