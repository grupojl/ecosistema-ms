import { WhatsAppChannel } from '@/infrastructure/channels/whatsapp/whatsapp.channel.js';
import { ChannelMediaService } from '@/infrastructure/channels/channel-media.service.js';
import type {
  ChannelAccountConfig,
  IncomingMessage,
} from '@/infrastructure/channels/channel.interface.js';

const cfg: ChannelAccountConfig = {
  externalId: 'phone-1',
  accessToken: 'tok',
  extraConfig: {},
  webhookVerifyToken: 'vt',
};

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('WhatsAppChannel.resolveMedia', () => {
  const ch = new WhatsAppChannel();

  it('consulta GET /{media-id} con el token y devuelve URL + Bearer', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://lookaside.fbsbx.com/m/1' }),
    });

    const out = await ch.resolveMedia('MEDIA 1', cfg);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v19.0/MEDIA%201');
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' });
    expect(out).toEqual({
      url: 'https://lookaside.fbsbx.com/m/1',
      headers: { Authorization: 'Bearer tok' },
    });
  });

  it('falla si Graph responde error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(ch.resolveMedia('m', cfg)).rejects.toThrow('404');
  });

  it.each([{}, { url: 'http://insecure/x' }])(
    'rechaza una respuesta sin URL https (%j)',
    async (body) => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(body),
      });
      await expect(ch.resolveMedia('m', cfg)).rejects.toThrow('https');
    },
  );
});

describe('ChannelMediaService', () => {
  const msg = (mediaUrl?: string): IncomingMessage => ({
    externalId: 'w1',
    senderExternalId: 's',
    type: 'audio',
    content: '[audio]',
    mediaUrl,
    timestamp: new Date(),
    raw: {},
  });
  const account = {
    id: 'ca1',
    organizationId: 'org1',
    ecosystemId: 'eco1',
    channelType: 'WHATSAPP',
    externalId: 'phone-1',
    accessToken: 'enc:tok',
    extraConfig: { a: 1 },
  };

  function build(channel: object, found: object | null = account) {
    const repo = {
      findChannelAccountById: jest.fn().mockResolvedValue(found),
    };
    const registry = { get: jest.fn().mockReturnValue(channel) };
    const cipher = { decrypt: jest.fn().mockReturnValue('tok') };
    const svc = new ChannelMediaService(
      repo as never,
      registry as never,
      cipher as never,
    );
    return { svc, repo, registry, cipher };
  }

  it('resuelve el medio con el token descifrado de la cuenta', async () => {
    const media = {
      url: 'https://x',
      headers: { Authorization: 'Bearer tok' },
    };
    const channel = { resolveMedia: jest.fn().mockResolvedValue(media) };
    const { svc, cipher } = build(channel);

    const out = await svc.resolve('ca1', 'WHATSAPP', msg('MEDIA1'));

    expect(cipher.decrypt).toHaveBeenCalledWith('enc:tok');
    expect(channel.resolveMedia).toHaveBeenCalledWith('MEDIA1', {
      externalId: 'phone-1',
      accessToken: 'tok',
      extraConfig: { a: 1 },
      webhookVerifyToken: '',
    });
    expect(out).toEqual({ organizationId: 'org1', media });
  });

  it('sin mediaUrl o con un canal sin resolveMedia, solo devuelve la organización', async () => {
    const withResolver = { resolveMedia: jest.fn() };
    expect(
      await build(withResolver).svc.resolve('ca1', 'WHATSAPP', msg()),
    ).toEqual({ organizationId: 'org1' });
    expect(withResolver.resolveMedia).not.toHaveBeenCalled();

    expect(
      await build({}).svc.resolve('ca1', 'MESSENGER', msg('https://u')),
    ).toEqual({ organizationId: 'org1' });
  });

  it('si el lookup falla no propaga: el adaptador degrada', async () => {
    const channel = {
      resolveMedia: jest.fn().mockRejectedValue(new Error('403')),
    };
    const out = await build(channel).svc.resolve(
      'ca1',
      'WHATSAPP',
      msg('MEDIA1'),
    );
    expect(out).toEqual({ organizationId: 'org1' });
  });

  it('cuenta inexistente → organización vacía', async () => {
    const out = await build({}, null).svc.resolve('x', 'WHATSAPP', msg('m'));
    expect(out).toEqual({ organizationId: '' });
  });
});
