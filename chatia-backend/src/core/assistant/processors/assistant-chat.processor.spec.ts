import { AssistantChatProcessor } from '@/core/assistant/processors/assistant-chat.processor.js';

describe('AssistantChatProcessor', () => {
  const chat = { chat: jest.fn() };
  const job = {
    id: 'j1',
    data: { projectSlug: 'p', userId: 'u1' },
    attemptsMade: 1,
    opts: { attempts: 3 },
  } as never;

  it('process ejecuta el chat con los datos del job y propaga el error para que BullMQ reintente', async () => {
    const proc = new AssistantChatProcessor(chat as never);
    chat.chat.mockResolvedValue(undefined);
    await proc.process(job);
    expect(chat.chat).toHaveBeenCalledWith({ projectSlug: 'p', userId: 'u1' });

    chat.chat.mockRejectedValue(new Error('llm'));
    await expect(proc.process(job)).rejects.toThrow('llm');
  });

  it('los hooks de eventos no lanzan', () => {
    const proc = new AssistantChatProcessor(chat as never);
    expect(() => proc.onFailed(job, new Error('x'))).not.toThrow();
    expect(() => proc.onCompleted(job)).not.toThrow();
  });
});
