// Tipos de `opossum` (v10). La librería no trae tipos propios y @types/opossum no está en el catálogo del
// monorepo, así que se declara aquí lo que usan los circuit breakers del servicio (CircuitBreakerService).
// Si se agrega @types/opossum al catálogo, eliminar este archivo.
declare module 'opossum' {
  export interface Options {
    /** ms antes de considerar que una llamada falló por timeout. */
    timeout?: number;
    /** % de fallos (sobre el volumen mínimo) que abre el circuito. */
    errorThresholdPercentage?: number;
    /** ms con el circuito abierto antes de probar de nuevo (half-open). */
    resetTimeout?: number;
    /** Llamadas mínimas en la ventana antes de evaluar el umbral. */
    volumeThreshold?: number;
  }

  export default class CircuitBreaker<
    TI extends unknown[] = unknown[],
    TR = unknown,
  > {
    constructor(action: (...args: TI) => Promise<TR>, options?: Options);
    fire(...args: TI): Promise<TR>;
    shutdown(): void;
    on(event: string, listener: (...args: unknown[]) => void): this;
    readonly opened: boolean;
    readonly halfOpen: boolean;
    readonly closed: boolean;
  }
}
