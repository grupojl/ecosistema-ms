import * as crypto from 'crypto';
import type { IChannel } from '@/infrastructure/channels/channel.interface.js';
import { WhatsAppChannel } from '@/infrastructure/channels/whatsapp/whatsapp.channel.js';
import { MessengerChannel } from '@/infrastructure/channels/messenger/messenger.channel.js';
import { InstagramChannel } from '@/infrastructure/channels/instagram/instagram.channel.js';
import { TikTokChannel } from '@/infrastructure/channels/tiktok/tiktok.channel.js';

const CONFIG = {
  externalId: 'phone-1',
  accessToken: 'tok',
  extraConfig: {},
  webhookVerifyToken: 'verify',
};
const sign = (body: Buffer, secret: string) =>
  crypto.createHmac('sha256', secret).update(body).digest('hex');

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
  global.fetch = fetchMock as unknown as typeof fetch;
});

const metaEvent = (mid: string, text?: string, attachments?: unknown[]) => ({
  sender: { id: 'u1' },
  timestamp: 1_700_000_000_000,
  message: { mid, text, attachments },
});

describe.each([
  ['WhatsApp', () => new WhatsAppChannel()],
  ['Messenger', () => new MessengerChannel()],
  ['Instagram', () => new InstagramChannel()],
] as Array<[string, () => IChannel]>)('%s — verificación común', (_n, make) => {
  const ch = make();

  it('verifyWebhook devuelve el challenge solo con token correcto', () => {
    const q = {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify',
      'hub.challenge': '123',
    };
    expect(ch.verifyWebhook(q, CONFIG)).toBe('123');
    expect(ch.verifyWebhook({ ...q, 'hub.verify_token': 'x' }, CONFIG)).toBe(
      false,
    );
    expect(ch.verifyWebhook({ ...q, 'hub.mode': 'unsubscribe' }, CONFIG)).toBe(
      false,
    );
  });

  it('verifySignature acepta la firma válida y rechaza la inválida o malformada', () => {
    const body = Buffer.from('{"a":1}');
    expect(ch.verifySignature(body, `sha256=${sign(body, 's')}`, 's')).toBe(
      true,
    );
    expect(ch.verifySignature(body, `sha256=${sign(body, 'otro')}`, 's')).toBe(
      false,
    );
    expect(ch.verifySignature(body, 'sha256=zz', 's')).toBe(false);
    expect(ch.verifySignature(body, '', 's')).toBe(false);
  });

  it('parseIncomingWebhook devuelve null con payloads basura', () => {
    expect(ch.parseIncomingWebhook(null)).toBeNull();
    expect(ch.parseIncomingWebhook({})).toBeNull();
    expect(ch.parseIncomingWebhook('texto')).toBeNull();
  });
});

describe('WhatsAppChannel', () => {
  const ch = new WhatsAppChannel();
  const payload = (messages: unknown[]) => ({
    entry: [
      {
        changes: [
          {
            value: {
              messages,
              contacts: [{ wa_id: '549', profile: { name: 'Ana' } }],
            },
          },
        ],
      },
    ],
  });

  it('parsea texto con nombre del contacto y timestamp', () => {
    const [m] = ch.parseIncomingWebhook(
      payload([
        {
          id: 'wamid.1',
          from: '549',
          timestamp: '1700000000',
          type: 'text',
          text: { body: 'hola' },
        },
      ]),
    )!;
    expect(m).toMatchObject({
      externalId: 'wamid.1',
      senderPhone: '549',
      senderName: 'Ana',
      type: 'text',
      content: 'hola',
    });
    expect(m.timestamp.getTime()).toBe(1_700_000_000_000);
  });

  it.each([
    [{ type: 'image', image: { id: 'i1', caption: 'foto' } }, 'foto', 'i1'],
    [{ type: 'image', image: { id: 'i1' } }, '[imagen]', 'i1'],
    [{ type: 'audio', audio: { id: 'a1' } }, '[audio]', 'a1'],
    [{ type: 'video', video: { id: 'v1' } }, '[video]', 'v1'],
    [
      { type: 'document', document: { id: 'd1', filename: 'dni.pdf' } },
      'dni.pdf',
      'd1',
    ],
    [{ type: 'sticker' }, '[sticker]', undefined],
    [
      { type: 'location', location: { latitude: 1, longitude: 2 } },
      '[ubicación] lat: 1, lon: 2',
      undefined,
    ],
    [{ type: 'reaction' }, '[mensaje]', undefined],
  ])('mapea %j', (extra, content, mediaUrl) => {
    const [m] = ch.parseIncomingWebhook(
      payload([{ id: 'x', from: '549', timestamp: '1', ...extra }]),
    )!;
    expect(m.content).toBe(content);
    expect(m.mediaUrl).toBe(mediaUrl);
  });

  it('ignora status updates (sin messages)', () => {
    expect(
      ch.parseIncomingWebhook({
        entry: [{ changes: [{ value: { statuses: [{}] } }] }],
      }),
    ).toBeNull();
  });

  it('envía texto a /{phone_number_id}/messages con Bearer', async () => {
    await ch.sendMessage({ to: '549', type: 'text', content: 'hi' }, CONFIG);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v23.0/phone-1/messages');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer tok',
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      messaging_product: 'whatsapp',
      to: '549',
      type: 'text',
      text: { body: 'hi' },
    });
  });

  it('quita el 9 de móviles argentinos (549… → 54…) al enviar', async () => {
    await ch.sendMessage(
      { to: '5493835117701', type: 'text', content: 'hi' },
      CONFIG,
    );
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string),
    ).toMatchObject({ to: '543835117701' });
  });

  it('envía imagen con link y lanza si la API responde error', async () => {
    await ch.sendMessage(
      { to: '549', type: 'image', content: 'c', mediaUrl: 'https://x/i.png' },
      CONFIG,
    );
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string),
    ).toMatchObject({ type: 'image', image: { link: 'https://x/i.png' } });

    fetchMock.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('boom'),
    });
    await expect(
      ch.sendMessage({ to: '549', type: 'text', content: 'x' }, CONFIG),
    ).rejects.toThrow('WhatsApp send failed: boom');
  });
});

describe.each([
  ['Messenger', new MessengerChannel()],
  ['Instagram', new InstagramChannel()],
] as Array<[string, IChannel]>)('%s — Meta Messaging', (name, ch) => {
  it('parsea TODOS los eventos de un webhook en lote', () => {
    const msgs = ch.parseIncomingWebhook({
      entry: [
        { messaging: [metaEvent('m1', 'uno'), metaEvent('m2', 'dos')] },
        { messaging: [metaEvent('m3', 'tres')] },
      ],
    })!;
    expect(msgs.map((m) => m.externalId)).toEqual(['m1', 'm2', 'm3']);
    expect(msgs[0]).toMatchObject({ senderExternalId: 'u1', content: 'uno' });
  });

  it('ignora eventos sin mensaje (delivery/read) y devuelve null si no queda nada', () => {
    expect(
      ch.parseIncomingWebhook({
        entry: [{ messaging: [{ sender: { id: 'u' }, timestamp: 1 }] }],
      }),
    ).toBeNull();
  });

  it('adjunto imagen → type image con url', () => {
    const [m] = ch.parseIncomingWebhook({
      entry: [
        {
          messaging: [
            metaEvent('m1', undefined, [
              { type: 'image', payload: { url: 'https://x/i.jpg' } },
            ]),
          ],
        },
      ],
    })!;
    expect(m).toMatchObject({
      type: 'image',
      content: 'https://x/i.jpg',
      mediaUrl: 'https://x/i.jpg',
    });
  });

  it('adjunto sin url → "[adjunto]"', () => {
    const [m] = ch.parseIncomingWebhook({
      entry: [{ messaging: [metaEvent('m1', undefined, [{ type: 'file' }])] }],
    })!;
    expect(m.content).toBe('[adjunto]');
  });

  it('envía con el token en el header, NO en la URL', async () => {
    await ch.sendMessage({ to: 'u1', type: 'text', content: 'hi' }, CONFIG);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v19.0/me/messages');
    expect(url).not.toContain('tok');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer tok',
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      recipient: { id: 'u1' },
      message: { text: 'hi' },
    });
  });

  it('envía imagen como attachment y lanza si falla', async () => {
    await ch.sendMessage(
      { to: 'u1', type: 'image', content: '', mediaUrl: 'https://x/i.png' },
      CONFIG,
    );
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string),
    ).toMatchObject({
      message: { attachment: { payload: { url: 'https://x/i.png' } } },
    });
    fetchMock.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('nope'),
    });
    await expect(
      ch.sendMessage({ to: 'u1', type: 'text', content: 'x' }, CONFIG),
    ).rejects.toThrow(`${name} send failed: nope`);
  });
});

describe('TikTokChannel', () => {
  const ch = new TikTokChannel();
  const dm = (over: Record<string, unknown> = {}) => ({
    event: 'direct_message',
    data: {
      message_id: 't1',
      message_type: 'text',
      create_time: 1_700_000_000,
      from: { open_id: 'o1', display_name: 'Beto', username: 'beto' },
      content: { text: 'hola' },
      ...over,
    },
  });

  it('verifyWebhook exige verify_token y challenge', () => {
    expect(
      ch.verifyWebhook({ verify_token: 'verify', challenge: 'c' }, CONFIG),
    ).toBe('c');
    expect(ch.verifyWebhook({ verify_token: 'verify' }, CONFIG)).toBe(false);
    expect(
      ch.verifyWebhook({ verify_token: 'x', challenge: 'c' }, CONFIG),
    ).toBe(false);
  });

  it('verifySignature: HMAC hex sin prefijo', () => {
    const body = Buffer.from('{}');
    expect(ch.verifySignature(body, sign(body, 's'), 's')).toBe(true);
    expect(ch.verifySignature(body, sign(body, 'x'), 's')).toBe(false);
    expect(ch.verifySignature(body, 'no-hex', 's')).toBe(false);
  });

  it('parsea un DM de texto', () => {
    const [m] = ch.parseIncomingWebhook(dm())!;
    expect(m).toMatchObject({
      externalId: 't1',
      senderExternalId: 'o1',
      senderName: 'Beto',
      senderUsername: 'beto',
      type: 'text',
      content: 'hola',
    });
    expect(m.timestamp.getTime()).toBe(1_700_000_000_000);
  });

  it('ignora otros eventos, DMs sin remitente y payload inválido', () => {
    expect(ch.parseIncomingWebhook({ event: 'follow' })).toBeNull();
    expect(ch.parseIncomingWebhook({ event: 'direct_message' })).toBeNull();
    expect(ch.parseIncomingWebhook(dm({ from: {} }))).toBeNull();
    expect(ch.parseIncomingWebhook(null)).toBeNull();
  });

  it('DM no-texto → image con url', () => {
    const [m] = ch.parseIncomingWebhook(
      dm({ message_type: 'image', content: { url: 'https://x/i.png' } }),
    )!;
    expect(m).toMatchObject({ type: 'image', mediaUrl: 'https://x/i.png' });
  });

  it('envía texto/imagen y lanza si falla', async () => {
    await ch.sendMessage({ to: 'o1', type: 'text', content: 'hi' }, CONFIG);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://open.tiktokapis.com/v2/direct/message/send/');
    expect(JSON.parse(init.body as string)).toMatchObject({
      to_user_id: 'o1',
      message_type: 'text',
      content: { text: 'hi' },
    });

    await ch.sendMessage(
      { to: 'o1', type: 'image', content: '', mediaUrl: 'https://x/i.png' },
      CONFIG,
    );
    expect(
      JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string),
    ).toMatchObject({ message_type: 'image' });

    fetchMock.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('x'),
    });
    await expect(
      ch.sendMessage({ to: 'o1', type: 'text', content: 'x' }, CONFIG),
    ).rejects.toThrow('TikTok send failed: x');
  });
});
