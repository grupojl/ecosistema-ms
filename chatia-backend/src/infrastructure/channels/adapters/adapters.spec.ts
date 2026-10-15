import { ProviderChainService } from '@/infrastructure/providers/provider-chain.service.js';
import { CircuitBreakerService } from '@/infrastructure/common/services/circuit-breaker.service.js';
import { SpeechToTextAdapter } from '@/infrastructure/channels/adapters/speech-to-text.adapter.js';
import { TextToSpeechAdapter } from '@/infrastructure/channels/adapters/text-to-speech.adapter.js';
import { ImageToTextAdapter } from '@/infrastructure/channels/adapters/image-to-text.adapter.js';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });
const bytes = (data: string, headers: Record<string, string> = {}): Response =>
  new Response(Buffer.from(data), { status: 200, headers });

const ENV_KEYS = [
  'GROQ_API_KEY',
  'SILICONFLOW_API_KEY',
  'SILICONFLOW_STT_MODEL',
  'CARTESIA_API_KEY',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_DEFAULT_VOICE_ID',
  'ANTHROPIC_API_KEY',
  'STT_PROVIDERS',
  'TTS_PROVIDERS',
  'IMAGE_PROVIDERS',
];

describe('adapters multimodales con cadena de proveedores', () => {
  let breaker: CircuitBreakerService;
  let chain: ProviderChainService;
  let fetchMock: jest.SpyInstance;
  const hosts = (): string[] =>
    fetchMock.mock.calls.map((c) => new URL(String(c[0])).host);

  beforeEach(() => {
    breaker = new CircuitBreakerService();
    chain = new ProviderChainService(breaker);
    ENV_KEYS.forEach((k) => delete process.env[k]);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    breaker.onModuleDestroy();
    ENV_KEYS.forEach((k) => delete process.env[k]);
  });

  describe('SpeechToTextAdapter', () => {
    const input = {
      type: 'audio' as const,
      content: '',
      mediaUrl: 'https://cdn.example.com/a.ogg',
    } as never;

    it('transcribe con Groq Whisper', async () => {
      process.env['GROQ_API_KEY'] = 'g';
      fetchMock
        .mockResolvedValueOnce(bytes('audio'))
        .mockResolvedValueOnce(json({ text: ' hola mundo ' }));
      await expect(new SpeechToTextAdapter(chain).toText(input)).resolves.toBe(
        'hola mundo',
      );
      expect(hosts()).toEqual(['cdn.example.com', 'api.groq.com']);
    });

    it('si Groq cae usa SiliconFlow (solo si hay modelo configurado)', async () => {
      process.env['GROQ_API_KEY'] = 'g';
      process.env['SILICONFLOW_API_KEY'] = 's';
      process.env['SILICONFLOW_STT_MODEL'] = 'org/stt';
      fetchMock
        .mockResolvedValueOnce(bytes('audio'))
        .mockResolvedValueOnce(new Response('x', { status: 500 }))
        .mockResolvedValueOnce(json({ text: 'desde sf' }));
      await expect(new SpeechToTextAdapter(chain).toText(input)).resolves.toBe(
        'desde sf',
      );
    });

    it('SiliconFlow sin SILICONFLOW_STT_MODEL queda apagado', async () => {
      process.env['SILICONFLOW_API_KEY'] = 's';
      fetchMock.mockResolvedValueOnce(bytes('audio'));
      await expect(
        new SpeechToTextAdapter(chain).toText(input),
      ).resolves.toContain('escribirlo');
    });

    it('toda la cadena caída → pide escribir (degradación a texto)', async () => {
      process.env['GROQ_API_KEY'] = 'g';
      fetchMock
        .mockResolvedValueOnce(bytes('audio'))
        .mockImplementation(() =>
          Promise.resolve(new Response('x', { status: 500 })),
        );
      await expect(
        new SpeechToTextAdapter(chain).toText(input),
      ).resolves.toContain('escribirlo');
    });

    it('sin mediaUrl no llama a ningún proveedor', async () => {
      await expect(
        new SpeechToTextAdapter(chain).toText({
          type: 'audio',
          content: 'texto',
        } as never),
      ).resolves.toBe('texto');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('TextToSpeechAdapter', () => {
    it('Cartesia primero', async () => {
      process.env['CARTESIA_API_KEY'] = 'c';
      fetchMock.mockResolvedValueOnce(bytes('ogg'));
      const res = await new TextToSpeechAdapter(chain).toAudio('hola');
      expect(res?.mimeType).toBe('audio/ogg');
      expect(hosts()).toEqual(['api.cartesia.ai']);
    });

    it('si Cartesia falla responde ElevenLabs con la voz de la org', async () => {
      process.env['CARTESIA_API_KEY'] = 'c';
      process.env['ELEVENLABS_API_KEY'] = 'e';
      fetchMock
        .mockResolvedValueOnce(new Response('x', { status: 500 }))
        .mockResolvedValueOnce(bytes('el-audio'));
      const res = await new TextToSpeechAdapter(chain).toAudio('hola', {
        elevenlabs: 'voz-org-1',
      });
      expect(res?.audioBuffer.toString()).toBe('el-audio');
      expect(String(fetchMock.mock.calls[1]![0])).toContain(
        '/text-to-speech/voz-org-1',
      );
      expect(
        (fetchMock.mock.calls[1]![1] as RequestInit).headers,
      ).toMatchObject({ 'xi-api-key': 'e' });
    });

    it('ElevenLabs sin voz (ni de la org ni por defecto) queda deshabilitado', async () => {
      process.env['ELEVENLABS_API_KEY'] = 'e';
      await expect(
        new TextToSpeechAdapter(chain).toAudio('hola'),
      ).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('usa ELEVENLABS_DEFAULT_VOICE_ID cuando la org no tiene voz', async () => {
      process.env['ELEVENLABS_API_KEY'] = 'e';
      process.env['ELEVENLABS_DEFAULT_VOICE_ID'] = 'voz-default';
      fetchMock.mockResolvedValueOnce(bytes('x'));
      await new TextToSpeechAdapter(chain).toAudio('hola');
      expect(String(fetchMock.mock.calls[0]![0])).toContain(
        '/text-to-speech/voz-default',
      );
    });

    it('todo caído → null (el caller responde en texto)', async () => {
      process.env['CARTESIA_API_KEY'] = 'c';
      fetchMock.mockImplementation(() =>
        Promise.resolve(new Response('x', { status: 500 })),
      );
      await expect(
        new TextToSpeechAdapter(chain).toAudio('hola'),
      ).resolves.toBeNull();
    });

    it('un string suelto se interpreta como voz de Cartesia (compatibilidad)', async () => {
      process.env['CARTESIA_API_KEY'] = 'c';
      fetchMock.mockResolvedValueOnce(bytes('x'));
      await new TextToSpeechAdapter(chain).toAudio('hola', 'voz-cartesia');
      expect(
        JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body))
          .voice.id,
      ).toBe('voz-cartesia');
    });
  });

  describe('ImageToTextAdapter', () => {
    const input = {
      type: 'image' as const,
      content: 'mi DNI',
      mediaUrl: 'https://cdn.example.com/i.jpg',
    } as never;
    const img = (): Response =>
      bytes('img', { 'content-type': 'image/jpeg; charset=binary' });

    it('con Anthropic configurado lo usa primero', async () => {
      process.env['ANTHROPIC_API_KEY'] = 'a';
      fetchMock
        .mockResolvedValueOnce(img())
        .mockResolvedValueOnce(
          json({ content: [{ type: 'text', text: 'un DNI' }] }),
        );
      const out = await new ImageToTextAdapter(chain).toText(input);
      expect(out).toContain('un DNI');
      expect(hosts()).toEqual(['cdn.example.com', 'api.anthropic.com']);
    });

    it('sin Anthropic cae a Groq Scout con la imagen como data URL', async () => {
      process.env['GROQ_API_KEY'] = 'g';
      fetchMock
        .mockResolvedValueOnce(img())
        .mockResolvedValueOnce(
          json({ choices: [{ message: { content: 'descripción' } }] }),
        );
      const out = await new ImageToTextAdapter(chain).toText(input);
      expect(out).toContain('descripción');
      const body = JSON.parse(
        String((fetchMock.mock.calls[1]![1] as RequestInit).body),
      ) as {
        messages: Array<{
          content: Array<{ type: string; image_url?: { url: string } }>;
        }>;
      };
      expect(body.messages[0]!.content[0]!.image_url!.url).toMatch(
        /^data:image\/jpeg;base64,/,
      ); // sin "; charset"
    });

    it('si Groq falla usa SiliconFlow', async () => {
      process.env['GROQ_API_KEY'] = 'g';
      process.env['SILICONFLOW_API_KEY'] = 's';
      fetchMock
        .mockResolvedValueOnce(img())
        .mockResolvedValueOnce(new Response('x', { status: 500 }))
        .mockResolvedValueOnce(
          json({ choices: [{ message: { content: 'qwen' } }] }),
        );
      await expect(
        new ImageToTextAdapter(chain).toText(input),
      ).resolves.toContain('qwen');
    });

    it('todo caído → usa el caption del usuario', async () => {
      process.env['GROQ_API_KEY'] = 'g';
      fetchMock
        .mockResolvedValueOnce(img())
        .mockImplementation(() =>
          Promise.resolve(new Response('x', { status: 500 })),
        );
      await expect(
        new ImageToTextAdapter(chain).toText(input),
      ).resolves.toContain('mi DNI');
    });
  });
});
