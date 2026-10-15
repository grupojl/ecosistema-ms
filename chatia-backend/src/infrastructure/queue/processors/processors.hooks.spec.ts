// Hooks del OutgoingMessageProcessor: umbral de último intento sin `attempts` explícito y logging de éxito.
import { OutgoingMessageProcessor } from '@/infrastructure/queue/processors/outgoing-message.processor.js';

describe('OutgoingMessageProcessor — hooks', () => {
  const data = {
    messageId: 'm1',
    conversationId: 'c1',
    organizationId: 'org1',
  };
  const build = () => {
    const prisma = {
      message: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const events = { emitMessageFailed: jest.fn() };
    const p = new OutgoingMessageProcessor(
      {} as never,
      prisma as never,
      events as never,
      {} as never,
    );
    return { p, prisma, events };
  };
  const job = (attemptsMade: number, attempts?: number) =>
    ({
      id: 'j1',
      data,
      attemptsMade,
      opts: attempts === undefined ? {} : { attempts },
    }) as never;

  it('sin `attempts` en el job el último intento es el 3: recién ahí marca FAILED', async () => {
    const { p, prisma, events } = build();
    await p.onFailed(job(2), new Error('x'));
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
    await p.onFailed(job(3), new Error('x'));
    expect(prisma.message.updateMany).toHaveBeenCalledTimes(1);
    expect(events.emitMessageFailed).toHaveBeenCalledWith('org1', 'c1', 'm1');
  });

  it('respeta `attempts` del job cuando existe', async () => {
    const { p, prisma } = build();
    await p.onFailed(job(3, 5), new Error('x'));
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
    await p.onFailed(job(5, 5), new Error('x'));
    expect(prisma.message.updateMany).toHaveBeenCalledTimes(1);
  });

  it('onCompleted solo registra, no toca la base', () => {
    const { p, prisma } = build();
    expect(() => p.onCompleted(job(1))).not.toThrow();
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });
});
