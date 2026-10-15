import { ChannelRegistry } from '@/infrastructure/channels/channel.registry.js';
import type { ChannelType } from '@/generated/prisma/client.js';

describe('ChannelRegistry', () => {
  const wa = { name: 'wa' };
  const ig = { name: 'ig' };
  const ms = { name: 'ms' };
  const tt = { name: 'tt' };
  const registry = new ChannelRegistry(
    wa as never,
    ig as never,
    ms as never,
    tt as never,
  );

  it.each([
    ['WHATSAPP', wa],
    ['INSTAGRAM', ig],
    ['MESSENGER', ms],
    ['TIKTOK', tt],
  ] as const)('%s resuelve a su canal (no a otro)', (type, expected) => {
    expect(registry.get(type)).toBe(expected);
  });

  it('un canal no soportado falla con un error claro (no devuelve undefined)', () => {
    expect(() => registry.get('TELEGRAM' as ChannelType)).toThrow(
      'Canal no soportado: TELEGRAM',
    );
  });
});
