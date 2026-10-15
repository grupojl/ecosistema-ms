import { NotFoundException } from '@nestjs/common';
import { KnowledgeBaseService } from '@/core/faq/knowledge-base/knowledge-base.service.js';

describe('KnowledgeBaseService — aislamiento por organización', () => {
  const repo = {
    projectBelongsTo: jest.fn(),
    createKnowledgeBase: jest.fn(),
    listKnowledgeBases: jest.fn(),
    findKnowledgeBase: jest.fn(),
    updateKnowledgeBase: jest.fn(),
    deleteKnowledgeBase: jest.fn(),
    getStats: jest.fn(),
  };
  let svc: KnowledgeBaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new KnowledgeBaseService(repo as never);
  });

  it('no permite crear una KB en un proyecto de OTRA organización', async () => {
    repo.projectBelongsTo.mockResolvedValue(false);
    await expect(
      svc.create('proj-ajeno', 'org-1', { name: 'x' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(repo.projectBelongsTo).toHaveBeenCalledWith('proj-ajeno', 'org-1');
    expect(repo.createKnowledgeBase).not.toHaveBeenCalled();
  });

  it('crea la KB cuando el proyecto es de la organización', async () => {
    repo.projectBelongsTo.mockResolvedValue(true);
    repo.createKnowledgeBase.mockResolvedValue({ id: 'kb-1' });
    const res = await svc.create('proj-1', 'org-1', { name: 'FAQ' } as never);
    expect(res.data).toEqual({ id: 'kb-1' });
    expect(repo.createKnowledgeBase).toHaveBeenCalledWith({
      name: 'FAQ',
      projectId: 'proj-1',
      organizationId: 'org-1',
    });
  });

  it('update y remove verifican que la KB sea de la organización antes de actuar', async () => {
    repo.findKnowledgeBase.mockResolvedValue(null);
    await expect(svc.update('kb-1', 'org-OTRA', {} as never)).rejects.toThrow(
      NotFoundException,
    );
    await expect(svc.remove('kb-1', 'org-OTRA')).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.findKnowledgeBase).toHaveBeenCalledWith('kb-1', 'org-OTRA');
    expect(repo.updateKnowledgeBase).not.toHaveBeenCalled();
    expect(repo.deleteKnowledgeBase).not.toHaveBeenCalled();
  });

  it('update y remove actúan cuando la KB es de la organización', async () => {
    repo.findKnowledgeBase.mockResolvedValue({ id: 'kb-1' });
    repo.updateKnowledgeBase.mockResolvedValue({ id: 'kb-1', name: 'Nuevo' });
    await svc.update('kb-1', 'org-1', { name: 'Nuevo' } as never);
    expect(repo.updateKnowledgeBase).toHaveBeenCalledWith('kb-1', {
      name: 'Nuevo',
    });
    expect((await svc.remove('kb-1', 'org-1')).success).toBe(true);
    expect(repo.deleteKnowledgeBase).toHaveBeenCalledWith('kb-1');
  });

  it('findAll lista por proyecto y organización', async () => {
    repo.listKnowledgeBases.mockResolvedValue([{ id: 'kb-1' }]);
    const res = await svc.findAll('proj-1', 'org-1');
    expect(repo.listKnowledgeBases).toHaveBeenCalledWith('proj-1', 'org-1');
    expect(res.data).toHaveLength(1);
  });

  it('getStats verifica la KB y arma el resumen', async () => {
    repo.findKnowledgeBase.mockResolvedValue({ id: 'kb-1' });
    repo.getStats.mockResolvedValue({
      total: 3,
      byStatus: [{ status: 'INDEXED', _count: { id: 3 } }],
      chunks: 40,
    });
    const res = await svc.getStats('kb-1', 'org-1');
    expect(res.data).toEqual({
      totalDocuments: 3,
      byStatus: [{ status: 'INDEXED', _count: { id: 3 } }],
      totalChunks: 40,
    });
  });
});
