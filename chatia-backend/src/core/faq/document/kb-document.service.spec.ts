import { NotFoundException } from '@nestjs/common';
import { KbDocumentService } from '@/core/faq/document/kb-document.service.js';

function build(withQueue = true) {
  const repo = {
    findKnowledgeBase: jest.fn(),
    createDocument: jest.fn().mockImplementation((data: object) => ({
      id: 'd1',
      status: 'PENDING',
      ...data,
    })),
    listDocuments: jest.fn().mockResolvedValue([]),
    findDocument: jest.fn(),
    deleteDocument: jest.fn().mockResolvedValue(undefined),
    resetDocumentForReindex: jest.fn().mockResolvedValue(undefined),
  };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const svc = new KbDocumentService(
    repo as never,
    (withQueue ? queue : null) as never,
  );
  return { svc, repo, queue };
}

describe('KbDocumentService', () => {
  it('create exige que la KB sea de la organización', async () => {
    const { svc, repo, queue } = build();
    repo.findKnowledgeBase.mockResolvedValue(null);
    await expect(
      svc.create('kb', 'org', { title: 't' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findKnowledgeBase).toHaveBeenCalledWith('kb', 'org');
    expect(repo.createDocument).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('create guarda el documento ligado a la KB y organización, y encola la ingesta con jobId único', async () => {
    const { svc, repo, queue } = build();
    repo.findKnowledgeBase.mockResolvedValue({ id: 'kb' });
    const res = await svc.create('kb', 'org', { title: 't' } as never);
    expect(repo.createDocument).toHaveBeenCalledWith({
      title: 't',
      knowledgeBaseId: 'kb',
      organizationId: 'org',
    });
    expect(res.data.id).toBe('d1');
    const [name, data, opts] = queue.add.mock.calls[0] as [
      string,
      unknown,
      { jobId: string },
    ];
    expect(name).toBe('faq-ingest-document');
    expect(data).toEqual({ documentId: 'd1', organizationId: 'org' });
    expect(opts.jobId).toMatch(/^ingest:d1:\d+$/);
  });

  it('sin Redis crea el documento y no falla', async () => {
    const { svc, repo } = build(false);
    repo.findKnowledgeBase.mockResolvedValue({ id: 'kb' });
    expect((await svc.create('kb', 'org', {} as never)).success).toBe(true);
  });

  it('findAll filtra por organización y, opcionalmente, por estado', async () => {
    const { svc, repo } = build();
    await svc.findAll('kb', 'org');
    expect(repo.listDocuments).toHaveBeenLastCalledWith('kb', 'org', undefined);
    await svc.findAll('kb', 'org', 'INDEXED');
    expect(repo.listDocuments).toHaveBeenLastCalledWith('kb', 'org', 'INDEXED');
  });

  it('reindex resetea el documento y vuelve a encolar', async () => {
    const { svc, repo, queue } = build();
    repo.findDocument.mockResolvedValue({ id: 'd1' });
    const res = await svc.reindex('d1', 'org');
    expect(repo.resetDocumentForReindex).toHaveBeenCalledWith('d1');
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(res.message).toContain('encolada');
  });

  it('reindex sin Redis lo informa', async () => {
    const { svc, repo } = build(false);
    repo.findDocument.mockResolvedValue({ id: 'd1' });
    expect((await svc.reindex('d1', 'org')).message).toContain('no disponible');
  });

  it('reindex y remove: 404 si el documento es de otra organización', async () => {
    const { svc, repo } = build();
    repo.findDocument.mockResolvedValue(null);
    await expect(svc.reindex('d1', 'otra')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(svc.remove('d1', 'otra')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findDocument).toHaveBeenCalledWith('d1', 'otra');
    expect(repo.deleteDocument).not.toHaveBeenCalled();
    expect(repo.resetDocumentForReindex).not.toHaveBeenCalled();
  });

  it('remove borra el documento', async () => {
    const { svc, repo } = build();
    repo.findDocument.mockResolvedValue({ id: 'd1' });
    expect((await svc.remove('d1', 'org')).success).toBe(true);
    expect(repo.deleteDocument).toHaveBeenCalledWith('d1');
  });
});
