import {
  EcosystemConfigSchema,
  RegisterEcosystemSchema,
} from '@/core/ecosystem/schemas.js';

describe('EcosystemConfigSchema', () => {
  it('acepta la configuración conocida y deja pasar claves extra (la strategy puede usarlas)', () => {
    const cfg = {
      projectType: 'welver',
      plan: 'growth',
      category: 'ropa',
      markets: ['AR', 'CL'],
      storeUrl: 'https://tienda.example.com',
      colorPrimario: '#fff',
    };
    expect(EcosystemConfigSchema.parse(cfg)).toEqual(cfg);
  });

  it('un ecosistema nuevo (projectType nuevo) no requiere tocar el schema', () => {
    expect(
      EcosystemConfigSchema.safeParse({ projectType: 'ecosistema-nuevo' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['projectType con mayúsculas o símbolos', { projectType: 'Welver; DROP' }],
    ['plan enorme', { plan: 'x'.repeat(51) }],
    ['mercados que no son códigos de 2 letras', { markets: ['ARG'] }],
    ['demasiados mercados', { markets: Array(51).fill('AR') }],
    ['storeUrl que no es URL', { storeUrl: 'no-es-url' }],
  ])('rechaza %s', (_name, cfg) => {
    expect(EcosystemConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('rechaza configuraciones de más de 16 KB (no se guarda JSON arbitrario)', () => {
    const big = { relleno: 'x'.repeat(17_000) };
    const res = EcosystemConfigSchema.safeParse(big);
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toContain('demasiado grande');
  });

  it('storeUrl puede ser null', () => {
    expect(EcosystemConfigSchema.safeParse({ storeUrl: null }).success).toBe(
      true,
    );
  });
});

describe('RegisterEcosystemSchema', () => {
  it('config es opcional (por defecto {}) y valida el resto', () => {
    const ok = RegisterEcosystemSchema.parse({
      firebaseProjectId: 'fb-1',
      name: 'Welver',
    });
    expect(ok.config).toEqual({});
    expect(
      RegisterEcosystemSchema.safeParse({ firebaseProjectId: '', name: 'x' })
        .success,
    ).toBe(false);
    expect(
      RegisterEcosystemSchema.safeParse({
        firebaseProjectId: 'fb',
        name: 'x',
        config: { projectType: 'MAL' },
      }).success,
    ).toBe(false);
  });
});
