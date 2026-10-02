// marketing-backend/src/infrastructure/types/opossum.d.ts
// Tipos complementarios para opossum circuit breaker
declare module "opossum" {
  interface CircuitBreaker {
    getStates(): Record<string, string>;
  }
}
