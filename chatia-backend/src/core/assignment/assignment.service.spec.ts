import { AssignmentService } from '@/core/assignment/assignment.service.js';

function build(agentIds: string[], counts: Array<[string, number]> = []) {
  const agents = {
    listActiveIdsByCreation: jest.fn().mockResolvedValue(agentIds),
  };
  const conversations = {
    countActiveByAgents: jest
      .fn()
      .mockResolvedValue(
        counts.map(([agentId, count]) => ({ agentId, count })),
      ),
  };
  return {
    svc: new AssignmentService(agents as never, conversations as never),
    agents,
    conversations,
  };
}

describe('AssignmentService', () => {
  it('sin agentes activos devuelve null', async () => {
    const { svc, agents } = build([]);
    expect(await svc.assignAgent('org1')).toBeNull();
    expect(agents.listActiveIdsByCreation).toHaveBeenCalledWith('org1');
  });

  it('least-load elige al de menor carga (agentes sin conversaciones cuentan 0)', async () => {
    const { svc, conversations } = build(
      ['a', 'b', 'c'],
      [
        ['a', 5],
        ['b', 2],
      ],
    );
    expect(await svc.assignAgent('org1', 'least-load')).toBe('c');
    expect(conversations.countActiveByAgents).toHaveBeenCalledWith([
      'a',
      'b',
      'c',
    ]);
  });

  it('least-load desempata por el primero y es la estrategia por defecto', async () => {
    const { svc } = build(
      ['a', 'b'],
      [
        ['a', 1],
        ['b', 1],
      ],
    );
    expect(await svc.assignAgent('org1')).toBe('a');
  });

  it('round-robin rota por organización y no consulta la carga', async () => {
    const { svc, conversations } = build(['a', 'b', 'c']);
    const seq: Array<string | null> = [];
    for (let i = 0; i < 4; i++)
      seq.push(await svc.assignAgent('org1', 'round-robin'));
    expect(seq).toEqual(['b', 'c', 'a', 'b']);
    // otra organización tiene su propio cursor
    expect(await svc.assignAgent('org2', 'round-robin')).toBe('b');
    expect(conversations.countActiveByAgents).not.toHaveBeenCalled();
  });
});
