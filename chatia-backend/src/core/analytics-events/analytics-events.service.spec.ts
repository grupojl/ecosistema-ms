import { AnalyticsEventsService } from '@/core/analytics-events/analytics-events.service.js';

function build() {
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  return { svc: new AnalyticsEventsService(queue as never), queue };
}
const flush = () => new Promise((r) => setImmediate(r));
const base = { ecosystemId: 'eco', organizationId: 'org' };

describe('AnalyticsEventsService (best-effort)', () => {
  it('track encola con una sola oportunidad (sin reintentos)', async () => {
    const { svc, queue } = build();
    const job = {
      ...base,
      eventType: 'message.sent' as const,
      payload: {},
      occurredAtUnix: 1,
    };
    await svc.track(job);
    expect(queue.add).toHaveBeenCalledWith('message.sent', job, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 1,
    });
  });

  it('track NUNCA lanza: si la cola falla se ignora', async () => {
    const { svc, queue } = build();
    queue.add.mockRejectedValue(new Error('redis caído'));
    await expect(
      svc.track({
        ...base,
        eventType: 'message.sent',
        payload: {},
        occurredAtUnix: 1,
      }),
    ).resolves.toBeUndefined();
  });

  it('trackConversationCreated arma el payload', async () => {
    const { svc, queue } = build();
    svc.trackConversationCreated({
      ...base,
      conversationId: 'c1',
      channel: 'WHATSAPP',
      contactId: 'k1',
    });
    await flush();
    expect(queue.add.mock.calls[0]![0]).toBe('conversation.created');
    expect(queue.add.mock.calls[0]![1].payload).toEqual({
      conversationId: 'c1',
      channel: 'WHATSAPP',
      contactId: 'k1',
    });
  });

  it('trackConversationResolved emite también resolved_by_agent solo si hubo agente', async () => {
    const { svc, queue } = build();
    svc.trackConversationResolved({ ...base, conversationId: 'c1' });
    await flush();
    expect(queue.add.mock.calls.map((c) => c[0])).toEqual([
      'conversation.resolved',
    ]);

    queue.add.mockClear();
    svc.trackConversationResolved({
      ...base,
      conversationId: 'c1',
      agentId: 'ag1',
      durationMin: 5,
    });
    await flush();
    expect(queue.add.mock.calls.map((c) => c[0])).toEqual([
      'conversation.resolved',
      'conversation.resolved_by_agent',
    ]);
  });

  it('trackConversationAssigned y trackMessageSent', async () => {
    const { svc, queue } = build();
    svc.trackConversationAssigned({
      ...base,
      conversationId: 'c1',
      agentId: 'ag1',
    });
    svc.trackMessageSent({
      ...base,
      conversationId: 'c1',
      direction: 'OUTBOUND',
      isAiGenerated: true,
    });
    await flush();
    expect(queue.add.mock.calls.map((c) => c[0])).toEqual([
      'conversation.assigned',
      'message.sent',
    ]);
    expect(queue.add.mock.calls[1]![1].payload).toMatchObject({
      direction: 'OUTBOUND',
      isAiGenerated: true,
    });
  });
});
