// pasarelapagos-backend/src/core/routing/routing.interface.ts
// Contrato del servicio de enrutamiento de negocio.
// ProviderRegistry (infraestructura) implementa el registro técnico.
// RoutingService (core) aplica las reglas de negocio para seleccionar el provider.

export const ROUTING_SERVICE = Symbol("ROUTING_SERVICE");

export interface IRoutingService {
  /** Selecciona el providerId correcto según país, moneda y método */
  selectProvider(params: {
    country:  string;
    currency: string;
    method:   string;
    tenantId?: string;
  }): Promise<string>;
}
