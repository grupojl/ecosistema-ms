import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ContactsService } from '@/core/contacts/contacts.service.js';

function build() {
  const repo = {
    list: jest.fn().mockResolvedValue({
      data: [{ id: 'c1' }],
      total: 45,
      page: 1,
      limit: 20,
    }),
    findOne: jest.fn(),
    update: jest.fn(),
    getStats: jest.fn().mockResolvedValue({ total: 3 }),
  };
  return { svc: new ContactsService(repo as never), repo };
}

describe('ContactsService', () => {
  it('list calcula las páginas y pasa organización + ecosistema al repositorio', async () => {
    const { svc, repo } = build();
    const res = await svc.list('org', 'eco', { page: 1 } as never);
    expect(repo.list).toHaveBeenCalledWith('org', 'eco', { page: 1 });
    expect(res.meta).toEqual({ total: 45, page: 1, limit: 20, pages: 3 });
  });

  it('findOne: 404 si el repositorio no lo encuentra (otro tenant incluido)', async () => {
    const { svc, repo } = build();
    repo.findOne.mockResolvedValue(null);
    await expect(svc.findOne('c1', 'org', 'eco')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    repo.findOne.mockResolvedValue({ id: 'c1' });
    expect((await svc.findOne('c1', 'org', 'eco')).data).toEqual({ id: 'c1' });
  });

  it('update rechaza etiquetas duplicadas con 422 sin tocar la base', async () => {
    const { svc, repo } = build();
    await expect(
      svc.update('c1', 'org', 'eco', { tags: ['vip', 'vip'] } as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('update: 404 si no existe, y devuelve el contacto si sí', async () => {
    const { svc, repo } = build();
    repo.update.mockResolvedValueOnce(null);
    await expect(
      svc.update('c1', 'org', 'eco', { name: 'x' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    repo.update.mockResolvedValueOnce({ id: 'c1', tags: ['a'] });
    const res = await svc.update('c1', 'org', 'eco', { tags: ['a'] } as never);
    expect(res.data).toEqual({ id: 'c1', tags: ['a'] });
  });

  it('getStats delega con el tenant', async () => {
    const { svc, repo } = build();
    expect((await svc.getStats('org', 'eco')).data).toEqual({ total: 3 });
    expect(repo.getStats).toHaveBeenCalledWith('org', 'eco');
  });
});
