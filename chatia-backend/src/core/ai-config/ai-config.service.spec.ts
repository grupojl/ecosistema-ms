import { NotFoundException } from '@nestjs/common';
import { AiConfigService } from '@/core/ai-config/ai-config.service.js';

function build() {
  const repo = {
    channelAccountBelongsTo: jest.fn().mockResolvedValue(true),
    findByChannelAccount: jest.fn(),
    create: jest.fn().mockImplementation((data: object) => data),
    upsert: jest
      .fn()
      .mockImplementation((_id: string, create: object, update: object) => ({
        create,
        update,
      })),
    setEnabled: jest.fn().mockResolvedValue({ id: 'cfg' }),
  };
  return { svc: new AiConfigService(repo as never), repo };
}

describe('AiConfigService', () => {
  it('todas las operaciones exigen que la cuenta sea de la organización', async () => {
    const { svc, repo } = build();
    repo.channelAccountBelongsTo.mockResolvedValue(false);
    await expect(svc.getOrCreate('ca1', 'otra')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(svc.update('ca1', 'otra', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(svc.toggleEnabled('ca1', 'otra', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.channelAccountBelongsTo).toHaveBeenCalledWith('ca1', 'otra');
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.upsert).not.toHaveBeenCalled();
    expect(repo.setEnabled).not.toHaveBeenCalled();
  });

  it('getOrCreate devuelve la existente o crea con valores por defecto', async () => {
    const { svc, repo } = build();
    repo.findByChannelAccount.mockResolvedValueOnce({ id: 'x' });
    expect((await svc.getOrCreate('ca1', 'org')).data).toEqual({ id: 'x' });
    repo.findByChannelAccount.mockResolvedValueOnce(null);
    const res = await svc.getOrCreate('ca1', 'org');
    expect(res.data).toMatchObject({
      channelAccountId: 'ca1',
      personaName: 'Asistente',
    });
  });

  it('update solo modifica los campos enviados y crea con defaults si no existía', async () => {
    const { svc } = build();
    const res = (await svc.update('ca1', 'org', {
      temperature: 0.2,
      isEnabled: false,
    })) as unknown as {
      data: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      };
    };
    expect(res.data.update).toEqual({ temperature: 0.2, isEnabled: false });
    expect(res.data.create).toMatchObject({
      channelAccountId: 'ca1',
      temperature: 0.2,
      isEnabled: false,
      maxTokens: 1024,
      personaName: 'Asistente',
    });
  });

  it('toggleEnabled informa el nuevo estado', async () => {
    const { svc, repo } = build();
    expect((await svc.toggleEnabled('ca1', 'org', true)).message).toContain(
      'habilitada',
    );
    expect(repo.setEnabled).toHaveBeenLastCalledWith('ca1', true);
    expect((await svc.toggleEnabled('ca1', 'org', false)).message).toContain(
      'deshabilitada',
    );
  });
});
