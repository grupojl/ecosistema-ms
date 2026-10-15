import { safeEqual } from '@/infrastructure/security/safe-equal.js';

describe('safeEqual', () => {
  it('true solo si son idénticos', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
    expect(safeEqual('abc123', 'abc124')).toBe(false);
  });

  it('false con vacíos/undefined aunque ambos lo sean (clave no configurada ≠ clave válida)', () => {
    expect(safeEqual(undefined, undefined)).toBe(false);
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual('x', undefined)).toBe(false);
    expect(safeEqual(null, 'x')).toBe(false);
  });

  it('no revienta con longitudes distintas', () => {
    expect(safeEqual('corta', 'una-clave-mucho-mas-larga')).toBe(false);
  });
});
