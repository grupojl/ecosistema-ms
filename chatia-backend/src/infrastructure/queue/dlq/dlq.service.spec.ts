import { DlqService } from '@/infrastructure/queue/dlq/dlq.service.js';

const failedJob = (
  id: string,
  retry = jest.fn().mockResolvedValue(undefined),
) => ({
  id,
  data: { x: id },
  failedReason: 'boom',
  attemptsMade: 3,
  retry,
});

function build() {
  const incoming = {
    getFailed: jest.fn().mockResolvedValue([]),
    getJob: jest.fn(),
    clean: jest.fn().mockResolvedValue([]),
  };
  const outgoing = {
    getFailed: jest.fn().mockResolvedValue([]),
    getJob: jest.fn(),
    clean: jest.fn().mockResolvedValue([]),
  };
  return {
    svc: new DlqService(incoming as never, outgoing as never),
    incoming,
    outgoing,
  };
}

describe('DlqService', () => {
  it('getStats cuenta los fallidos y muestra como máximo 10 por cola', async () => {
    const { svc, incoming, outgoing } = build();
    incoming.getFailed.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => failedJob(`i${i}`)),
    );
    outgoing.getFailed.mockResolvedValue([failedJob('o1')]);

    const stats = await svc.getStats();

    expect(stats.incoming.failed).toBe(12);
    expect(stats.incoming.jobs).toHaveLength(10);
    expect(stats.outgoing).toMatchObject({ failed: 1 });
    expect(stats.outgoing.jobs[0]).toMatchObject({
      id: 'o1',
      failedReason: 'boom',
      attemptsMade: 3,
    });
  });

  it('retryJob reintenta en la cola correcta y falla si no existe', async () => {
    const { svc, outgoing, incoming } = build();
    const job = failedJob('j1');
    outgoing.getJob.mockResolvedValue(job);
    expect(await svc.retryJob('outgoing', 'j1')).toEqual({
      retried: true,
      jobId: 'j1',
    });
    expect(job.retry).toHaveBeenCalledWith('failed');
    expect(incoming.getJob).not.toHaveBeenCalled();

    incoming.getJob.mockResolvedValue(null);
    await expect(svc.retryJob('incoming', 'zz')).rejects.toThrow('not found');
  });

  it('retryAll cuenta solo los reintentos que salieron bien', async () => {
    const { svc, incoming } = build();
    incoming.getFailed.mockResolvedValue([
      failedJob('a'),
      failedJob('b', jest.fn().mockRejectedValue(new Error('ya no está'))),
      failedJob('c'),
    ]);
    expect(await svc.retryAll('incoming')).toEqual({ retried: 2, total: 3 });
  });

  it('clearDlq limpia solo los fallidos de la cola indicada', async () => {
    const { svc, incoming, outgoing } = build();
    expect(await svc.clearDlq('incoming')).toEqual({ cleared: true });
    expect(incoming.clean).toHaveBeenCalledWith(0, 1000, 'failed');
    expect(outgoing.clean).not.toHaveBeenCalled();
  });
});
