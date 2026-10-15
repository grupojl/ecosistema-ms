import { ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { addWithTimeout } from '@/infrastructure/queue/add-with-timeout.js';

describe('addWithTimeout', () => {
  afterEach(() => delete process.env['QUEUE_ADD_TIMEOUT_MS']);

  it('devuelve el resultado cuando la cola responde a tiempo', async () => {
    await expect(
      addWithTimeout(() => Promise.resolve('job-1'), 'q'),
    ).resolves.toBe('job-1');
  });

  it('propaga el error original de la cola', async () => {
    await expect(
      addWithTimeout(() => Promise.reject(new Error('boom')), 'q'),
    ).rejects.toThrow('boom');
  });

  it('si la cola no responde, falla con 503 dentro del tope y nombra la cola', async () => {
    process.env['QUEUE_ADD_TIMEOUT_MS'] = '50';
    const t0 = Date.now();
    const err = await addWithTimeout(
      () => new Promise(() => undefined),
      'incoming-message',
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as Error).message).toContain('incoming-message');
    expect(Date.now() - t0).toBeLessThan(1_000);
  });

  // Reproduce el problema real: BullMQ contra un Redis caído no falla, queda esperando la conexión.
  it('con un Redis REALMENTE caído, queue.add de BullMQ se cuelga y el tope lo convierte en 503', async () => {
    process.env['QUEUE_ADD_TIMEOUT_MS'] = '400';
    const q = new Queue('down', { connection: { url: 'redis://127.0.0.1:1' } });
    q.on('error', () => undefined);
    try {
      await expect(
        addWithTimeout(() => q.add('j', { a: 1 }), 'down'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      await q.close().catch(() => undefined);
    }
  }, 15_000);
});
