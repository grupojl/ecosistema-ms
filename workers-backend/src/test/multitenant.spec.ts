/**
 * Suite de aislamiento multi-tenant — DT-025
 *
 * Verifica que ningún endpoint o query retorna datos de otro ecosistema.
 * Cada servicio debe tener al menos los tests marcados con TODO completados
 * antes de ir a producción con múltiples ecosistemas.
 */
describe('Multi-tenant isolation', () => {
  describe('Cross-ecosystem data isolation', () => {
    it.todo('GET /[recurso] con ecosystemId=welver no retorna datos de ecosystemId=manzana');
    it.todo('findMany siempre incluye ecosystemId en el where clause');
    it.todo('un token de ecosystemId=A no puede leer organizaciones de ecosystemId=B');
  });

  describe('Organization isolation within ecosystem', () => {
    it.todo('datos de organizationId=org1 no son visibles desde organizationId=org2 del mismo ecosistema');
  });
});
