// Declaración complementaria de tipos para opossum
// Generada por x.sh — ADR-007: tipos explícitos en todos los boundaries
// opossum tiene tipos parciales; esta declaración cubre los métodos internos
// que usamos en los circuit-breaker services del ecosistema.
//
// Ref: https://nodeshift.dev/opossum/
// Cuando @types/opossum cubra estos métodos, eliminar este archivo.

import CircuitBreaker from "opossum";

declare module "opossum" {
  interface CircuitBreaker<TI extends unknown[] = unknown[], TR = unknown> {
    /**
     * Reemplaza la función de acción del circuit breaker en runtime.
     * Usado en el patrón de re-wrapping de CircuitBreakerService.
     * @internal — no documentado en la API pública de opossum
     */
    action: (...args: TI) => Promise<TR>;

    /**
     * Retorna el estado de todos los circuit breakers registrados.
     * @internal — disponible en opossum >= 6.0
     */
    getStates?(): Promise<Record<string, string>>;
  }
}
