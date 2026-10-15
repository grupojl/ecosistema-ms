import { MultimodalService } from '@/infrastructure/channels/multimodal.service.js';
import { DocumentToTextAdapter } from '@/infrastructure/channels/adapters/document-to-text.adapter.js';
import { LocationToTextAdapter } from '@/infrastructure/channels/adapters/location-to-text.adapter.js';
import type { IncomingMessage } from '@/infrastructure/channels/channel.interface.js';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const msg = (over: Partial<IncomingMessage>): IncomingMessage =>
  ({
    externalId: 'm1',
    senderExternalId: 's',
    type: 'text',
    content: '',
    timestamp: new Date(),
    raw: {},
    ...over,
  }) as IncomingMessage;

describe('MultimodalService — el LLM siempre recibe texto', () => {
  const adapter = (text: string) => ({
    toText: jest.fn().mockResolvedValue(text),
  });
  const build = () => {
    const a = {
      stt: adapter('transcripción'),
      img: adapter('descripción de imagen'),
      doc: adapter('texto del documento'),
      loc: adapter('ubicación'),
      vid: adapter('video'),
      tts: {
        toAudio: jest.fn().mockResolvedValue({ audio: Buffer.from('x') }),
      },
    };
    const svc = new MultimodalService(
      a.stt as never,
      a.img as never,
      a.doc as never,
      a.loc as never,
      a.vid as never,
      a.tts as never,
    );
    return { svc, a };
  };

  it('texto: pasa tal cual y no usa ningún adapter', async () => {
    const { svc, a } = build();
    const out = await svc.normalize(
      msg({ type: 'text', content: 'hola' }),
      'org',
    );
    expect(out).toEqual({
      text: 'hola',
      originalType: 'text',
      wasConverted: false,
      respondWithAudio: false,
    });
    expect(a.stt.toText).not.toHaveBeenCalled();
  });

  it.each([
    ['image', 'img', 'descripción de imagen', false],
    ['document', 'doc', 'texto del documento', false],
    ['location', 'loc', 'ubicación', false],
    ['video', 'vid', 'video', false],
    ['audio', 'stt', 'transcripción', true], // las notas de voz se responden con voz
  ] as const)(
    '%s usa su adapter y marca wasConverted',
    async (type, key, text, audio) => {
      const { svc, a } = build();
      const out = await svc.normalize(
        msg({ type, mediaUrl: 'https://m/x', content: 'c' }),
        'org-1',
      );
      expect(out).toEqual({
        text,
        originalType: type,
        wasConverted: true,
        respondWithAudio: audio,
      });
      expect(a[key].toText).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaUrl: 'https://m/x',
          organizationId: 'org-1',
        }),
      );
    },
  );

  it('sticker y tipos desconocidos no se convierten pero siempre devuelven texto', async () => {
    const { svc } = build();
    expect((await svc.normalize(msg({ type: 'sticker' }), 'o')).text).toContain(
      'sticker',
    );
    const unknown = await svc.normalize(
      msg({ type: 'reaction' as never, content: '' }),
      'o',
    );
    expect(unknown.text).toBe('[Mensaje no soportado]');
    expect(unknown.wasConverted).toBe(false);
  });

  it('toAudio delega en el adapter de texto a voz', async () => {
    const { svc, a } = build();
    expect(await svc.toAudio('hola', 'org')).toEqual({
      audio: Buffer.from('x'),
    });
    expect(a.tts.toAudio).toHaveBeenCalledWith('hola');
  });
});

describe('DocumentToTextAdapter', () => {
  const adapter = new DocumentToTextAdapter();
  const reply = (
    body: string | Buffer,
    contentType: string,
    ok = true,
    status = 200,
  ) => ({
    ok,
    status,
    headers: { get: () => contentType },
    arrayBuffer: () => {
      const b = Buffer.isBuffer(body) ? body : Buffer.from(body);
      return Promise.resolve(
        b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      );
    },
  });
  const input = (mediaUrl?: string, content = '') => ({
    mediaUrl,
    content,
    raw: {},
    organizationId: 'org',
  });

  it('sin URL devuelve el caption o un aviso', async () => {
    expect(await adapter.toText(input(undefined, 'mi factura'))).toBe(
      'mi factura',
    );
    expect(await adapter.toText(input())).toContain('sin URL');
  });

  it('texto plano', async () => {
    fetchMock.mockResolvedValue(reply('Hola mundo', 'text/plain'));
    expect(await adapter.toText(input('https://m/a.txt'))).toContain(
      'Hola mundo',
    );
  });

  it('PDF: extrae el texto de los bloques BT/ET', async () => {
    const pdf =
      '%PDF-1.4\nBT\n(Primera linea) Tj\n(Segunda linea) Tj\nET\n%%EOF';
    fetchMock.mockResolvedValue(reply(pdf, 'application/pdf'));
    const out = await adapter.toText(input('https://m/doc'));
    expect(out).toContain('Primera linea');
    expect(out).toContain('Segunda linea');
  });

  it('detecta PDF por la extensión aunque el content-type no lo diga', async () => {
    fetchMock.mockResolvedValue(
      reply('BT\n(Contenido) Tj\nET', 'application/octet-stream'),
    );
    expect(await adapter.toText(input('https://m/archivo.PDF'))).toContain(
      'Contenido',
    );
  });

  it('trunca documentos largos antes de enviarlos al LLM', async () => {
    fetchMock.mockResolvedValue(reply('x'.repeat(9000), 'text/plain'));
    const out = await adapter.toText(input('https://m/largo.txt'));
    expect(out).toContain('documento truncado');
    expect(out.length).toBeLessThan(4300);
  });

  it('sin texto legible o con error de descarga, pregunta al usuario en vez de fallar', async () => {
    fetchMock.mockResolvedValue(reply('%PDF sin texto', 'application/pdf'));
    expect(await adapter.toText(input('https://m/img.pdf'))).toContain(
      'no contiene texto legible',
    );
    fetchMock.mockResolvedValue(reply('', 'text/plain', false, 403));
    expect(await adapter.toText(input('https://m/x.txt'))).toContain(
      'no pude leerlo',
    );
    fetchMock.mockRejectedValue(new Error('red'));
    expect(await adapter.toText(input('https://m/x.txt'))).toContain(
      'no pude leerlo',
    );
  });

  it('otros formatos se intentan como texto', async () => {
    fetchMock.mockResolvedValue(reply('contenido raro', 'application/x-otro'));
    expect(await adapter.toText(input('https://m/x.bin'))).toContain(
      'contenido raro',
    );
  });
});

describe('LocationToTextAdapter', () => {
  const adapter = new LocationToTextAdapter();
  const input = (raw: Record<string, unknown>, content = '') => ({
    content,
    raw,
    organizationId: 'org',
  });

  it('sin coordenadas devuelve el contenido o un aviso', async () => {
    expect(await adapter.toText(input({}, 'plaza'))).toBe('plaza');
    expect(await adapter.toText(input({}))).toContain('sin coordenadas');
  });

  it('si WhatsApp ya trae nombre/dirección no consulta a OSM', async () => {
    const out = await adapter.toText(
      input({
        location: {
          latitude: -34.6,
          longitude: -58.4,
          name: 'Plaza',
          address: 'Av. 9 de Julio',
        },
      }),
    );
    expect(out).toContain('Plaza, Av. 9 de Julio');
    expect(out).toContain('-34.600000');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('geocodificación inversa con OSM Nominatim (display_name)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ display_name: 'Obelisco, Buenos Aires' }),
    });
    const out = await adapter.toText(
      input({ latitude: -34.6, longitude: -58.4 }),
    );
    expect(out).toContain('Obelisco, Buenos Aires');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toMatchObject({
      'User-Agent': 'chatia-backend/1.0',
    });
  });

  it('arma la dirección con los componentes si no hay display_name', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          address: {
            road: 'Corrientes',
            house_number: '1234',
            suburb: 'Centro',
            city: 'CABA',
            state: 'BA',
          },
        }),
    });
    const out = await adapter.toText(
      input({ latitude: -34.6, longitude: -58.4 }),
    );
    expect(out).toContain('Corrientes 1234, Centro, CABA, BA');
  });

  it('si OSM falla degrada a coordenadas (nunca rompe)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    expect(
      await adapter.toText(input({ latitude: 1, longitude: 2 })),
    ).toContain('lat 1.000000, lng 2.000000');
    fetchMock.mockRejectedValue(new Error('timeout'));
    expect(
      await adapter.toText(input({ latitude: 1, longitude: 2 })),
    ).toContain('lat 1.000000');
  });

  it('acepta coordenadas en la raíz del raw', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ display_name: 'X' }),
    });
    expect(
      await adapter.toText(input({ latitude: 5, longitude: 6 })),
    ).toContain('(5.000000, 6.000000)');
  });
});
