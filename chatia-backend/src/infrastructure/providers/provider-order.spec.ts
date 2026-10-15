import { parseProviderOrder } from '@/infrastructure/providers/provider-order.js';

describe('parseProviderOrder', () => {
  const known = ['groq', 'siliconflow'] as const;

  it('usa el default si no hay valor', () => {
    expect(
      parseProviderOrder(undefined, known, ['groq', 'siliconflow']),
    ).toEqual(['groq', 'siliconflow']);
    expect(parseProviderOrder('', known, ['groq'])).toEqual(['groq']);
  });

  it('respeta el orden pedido, ignora mayúsculas y espacios', () => {
    expect(parseProviderOrder(' SiliconFlow , groq ', known, ['groq'])).toEqual(
      ['siliconflow', 'groq'],
    );
  });

  it('descarta nombres desconocidos y duplicados', () => {
    expect(
      parseProviderOrder('groq,openai,groq', known, ['siliconflow']),
    ).toEqual(['groq']);
  });

  it('si todo es desconocido cae al default', () => {
    expect(parseProviderOrder('foo,bar', known, ['siliconflow'])).toEqual([
      'siliconflow',
    ]);
  });
});
