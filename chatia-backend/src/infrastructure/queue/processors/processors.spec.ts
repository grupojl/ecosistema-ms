import type { Job } from 'bullmq';
import { IncomingMessageProcessor } from '@/infrastructure/queue/processors/incoming-message.processor.js';
import {
  OutgoingMessageProcessor,
  type OutgoingMessageJobData,
} from '@/infrastructure/queue/processors/outgoing-message.processor.js';
import { AutoReplyProcessor } from '@/infrastructure/queue/processors/auto-reply.processor.js';

const job = <T>(data: T, over: Record<string, unknown> = {}) =>
  ({
    id: 'j1',
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...over,
  }) as unknown as Job<T>;

describe('IncomingMessageProcessor', () => {
  it('normaliza el mensaje a texto y lo entrega a ConversationsService', async () => {
    const conversations = {
      handleIncomingMessage: jest.fn().mockResolvedValue(undefined),
    };
    const multimodal = {
      normalize: jest.fn().mockResolvedValue({ text: 'texto transcripto' }),
    };
    const media = {
      url: 'https://cdn/x',
      headers: { Authorization: 'Bearer t' },
    };
    const channelMedia = {
      resolve: jest.fn().mockResolvedValue({ organizationId: 'org1', media }),
    };
    const p = new IncomingMessageProcessor(
      conversations as never,
      multimodal as never,
      channelMedia as never,
    );
    const msg = { externalId: 'w1', content: '[audio]', type: 'audio' };

    await p.process(
      job({ channelAccountId: 'ca1', channelType: 'WHATSAPP', msg }) as never,
    );

    expect(channelMedia.resolve).toHaveBeenCalledWith('ca1', 'WHATSAPP', msg);
    expect(multimodal.normalize).toHaveBeenCalledWith(msg, 'org1', media);

    expect(conversations.handleIncomingMessage).toHaveBeenCalledWith(
      'ca1',
      'WHATSAPP',
      { ...msg, content: 'texto transcripto' },
    );
  });

  it('si falla, propaga el error (BullMQ reintenta) y los hooks no lanzan', async () => {
    const conversations = {
      handleIncomingMessage: jest.fn().mockRejectedValue(new Error('db')),
    };
    const p = new IncomingMessageProcessor(
      conversations as never,
      {
        normalize: jest.fn().mockResolvedValue({ text: 'x' }),
      } as never,
      {
        resolve: jest.fn().mockResolvedValue({ organizationId: 'org1' }),
      } as never,
    );
    const j = job({
      channelAccountId: 'ca1',
      channelType: 'WHATSAPP',
      msg: { externalId: 'w1' },
    });
    await expect(p.process(j as never)).rejects.toThrow('db');
    expect(() => p.onFailed(j as never, new Error('db'))).not.toThrow();
    expect(() => p.onCompleted(j as never)).not.toThrow();
  });
});

describe('OutgoingMessageProcessor', () => {
  const data: OutgoingMessageJobData = {
    messageId: 'm1',
    conversationId: 'c1',
    organizationId: 'org1',
    channelType: 'WHATSAPP',
    recipientExternalId: '549',
    text: 'hola',
    accessToken: 'enc:tok',
    externalId: 'phone-1',
    extraConfig: {},
    webhookVerifyToken: 'vt',
  };

  function build() {
    const channel = { sendMessage: jest.fn().mockResolvedValue(undefined) };
    const registry = { get: jest.fn().mockReturnValue(channel) };
    const prisma = {
      message: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const events = { emitMessageFailed: jest.fn() };
    const cipher = { decrypt: jest.fn().mockReturnValue('tok-plain') };
    const p = new OutgoingMessageProcessor(
      registry as never,
      prisma as never,
      events as never,
      cipher as never,
    );
    return { p, channel, registry, prisma, events, cipher };
  }

  it('descifra el token recién al enviar y marca SENT solo si estaba PENDING', async () => {
    const { p, channel, registry, prisma, cipher } = build();
    await p.process(job(data));

    expect(registry.get).toHaveBeenCalledWith('WHATSAPP');
    expect(cipher.decrypt).toHaveBeenCalledWith('enc:tok');
    expect(channel.sendMessage).toHaveBeenCalledWith(
      { to: '549', type: 'text', content: 'hola' },
      {
        externalId: 'phone-1',
        accessToken: 'tok-plain',
        extraConfig: {},
        webhookVerifyToken: 'vt',
      },
    );
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'm1',
        status: 'PENDING',
        conversation: { channelAccount: { organizationId: 'org1' } },
      },
      data: { status: 'SENT' },
    });
  });

  it('si el canal falla no marca SENT', async () => {
    const { p, channel, prisma } = build();
    channel.sendMessage.mockRejectedValue(new Error('meta 500'));
    await expect(p.process(job(data))).rejects.toThrow('meta 500');
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });

  it('en el último intento marca FAILED y avisa por WebSocket', async () => {
    const { p, prisma, events } = build();
    await p.onFailed(job(data, { attemptsMade: 3 }), new Error('x'));
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'm1',
        conversation: { channelAccount: { organizationId: 'org1' } },
      },
      data: { status: 'FAILED' },
    });
    expect(events.emitMessageFailed).toHaveBeenCalledWith('org1', 'c1', 'm1');
  });

  it('en intentos intermedios no marca FAILED', async () => {
    const { p, prisma, events } = build();
    await p.onFailed(job(data, { attemptsMade: 1 }), new Error('x'));
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
    expect(events.emitMessageFailed).not.toHaveBeenCalled();
    expect(() => p.onCompleted(job(data))).not.toThrow();
  });
});

describe('AutoReplyProcessor', () => {
  it('delega en AutoReplyService.reply', async () => {
    const reply = jest.fn().mockResolvedValue({ status: 'replied' });
    const p = new AutoReplyProcessor({ reply } as never);
    const d = { conversationId: 'c1', inboundMessageId: 'm1' };
    expect(await p.process(job(d))).toEqual({ status: 'replied' });
    expect(reply).toHaveBeenCalledWith(d);
  });

  it('onFailed tolera job undefined', () => {
    const p = new AutoReplyProcessor({} as never);
    expect(() => p.onFailed(undefined, new Error('x'))).not.toThrow();
  });
});
