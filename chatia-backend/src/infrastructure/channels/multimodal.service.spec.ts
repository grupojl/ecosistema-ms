import { MultimodalService } from '@/infrastructure/channels/multimodal.service.js';
import type { IncomingMessage } from '@/infrastructure/channels/channel.interface.js';

const msg = (over: Partial<IncomingMessage>): IncomingMessage => ({
  externalId: 'm1',
  senderExternalId: 's1',
  type: 'text',
  content: 'hola',
  timestamp: new Date(0),
  raw: { k: 'v' },
  ...over,
});

describe('MultimodalService', () => {
  const adapter = (text: string) => ({
    toText: jest.fn().mockResolvedValue(text),
  });
  const build = () => {
    const stt = adapter('transcripción');
    const img = adapter('descripción de imagen');
    const doc = adapter('texto del documento');
    const loc = adapter('ubicación: -34,-58');
    const vid = adapter('resumen del video');
    const tts = { toAudio: jest.fn().mockResolvedValue({ audio: 'bytes' }) };
    const svc = new MultimodalService(
      stt as never,
      img as never,
      doc as never,
      loc as never,
      vid as never,
      tts as never,
    );
    return { svc, stt, img, doc, loc, vid, tts };
  };

  it('texto: pasa tal cual, sin adapter y sin audio', async () => {
    const { svc, stt, img } = build();
    expect(await svc.normalize(msg({ content: 'buen día' }), 'org1')).toEqual({
      text: 'buen día',
      originalType: 'text',
      wasConverted: false,
      respondWithAudio: false,
    });
    expect(stt.toText).not.toHaveBeenCalled();
    expect(img.toText).not.toHaveBeenCalled();
  });

  it('audio: transcribe, marca conversión y pide responder con audio', async () => {
    const { svc, stt } = build();
    const r = await svc.normalize(
      msg({ type: 'audio', mediaUrl: 'https://m/a.ogg', content: '' }),
      'org1',
    );
    expect(r).toEqual({
      text: 'transcripción',
      originalType: 'audio',
      wasConverted: true,
      respondWithAudio: true,
    });
    expect(stt.toText).toHaveBeenCalledWith({
      mediaUrl: 'https://m/a.ogg',
      content: '',
      raw: { k: 'v' },
      organizationId: 'org1',
    });
  });

  it.each([
    ['image', 'img', 'descripción de imagen'],
    ['document', 'doc', 'texto del documento'],
    ['location', 'loc', 'ubicación: -34,-58'],
    ['video', 'vid', 'resumen del video'],
  ] as const)(
    '%s: usa su adapter, marca conversión y NO responde con audio',
    async (type, key, text) => {
      const b = build();
      const r = await b.svc.normalize(msg({ type }), 'org1');
      expect(r).toEqual({
        text,
        originalType: type,
        wasConverted: true,
        respondWithAudio: false,
      });
      expect(b[key].toText).toHaveBeenCalledTimes(1);
      // cada tipo usa SOLO su adapter
      for (const other of ['stt', 'img', 'doc', 'loc', 'vid'] as const) {
        if (other !== key) expect(b[other].toText).not.toHaveBeenCalled();
      }
    },
  );

  it('sticker: texto fijo, sin adapter', async () => {
    const r = await build().svc.normalize(msg({ type: 'sticker' }), 'org1');
    expect(r).toEqual({
      text: '[El usuario envió un sticker]',
      originalType: 'sticker',
      wasConverted: false,
      respondWithAudio: false,
    });
  });

  it('tipo desconocido: usa el contenido si lo hay, si no un texto de "no soportado"', async () => {
    const { svc } = build();
    const unknown = { type: 'reaction' as never };
    expect(
      await svc.normalize(msg({ ...unknown, content: 'me gusta' }), 'org1'),
    ).toEqual({
      text: 'me gusta',
      originalType: 'reaction',
      wasConverted: false,
      respondWithAudio: false,
    });
    expect(
      (await svc.normalize(msg({ ...unknown, content: '' }), 'org1')).text,
    ).toBe('[Mensaje no soportado]');
  });

  it('si el adapter falla, el error se propaga (el job se reintenta, no se inventa texto)', async () => {
    const { svc, img } = build();
    img.toText.mockRejectedValue(new Error('visión caída'));
    await expect(svc.normalize(msg({ type: 'image' }), 'org1')).rejects.toThrow(
      'visión caída',
    );
  });

  it('toAudio delega en TTS', async () => {
    const { svc, tts } = build();
    expect(await svc.toAudio('hola', 'org1')).toEqual({ audio: 'bytes' });
    expect(tts.toAudio).toHaveBeenCalledWith('hola');
  });
});
