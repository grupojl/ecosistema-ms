// 0 imports de NestJS/Prisma — errores de dominio puros
export abstract class DomainError extends Error {
  constructor(message: string) { super(message); this.name = this.constructor.name; }
}
export class InvalidWeightError       extends DomainError {
  constructor(g: number) { super(`Peso inválido: ${g}g — debe ser > 0`); }
}
export class InvalidDimensionsError   extends DomainError {
  constructor(f: string, v: number) { super(`Dimensión inválida: ${f}=${v} — debe ser > 0`); }
}
export class ShipmentAlreadyCancelledError extends DomainError {
  constructor() { super('El envío ya fue cancelado'); }
}
export class ShipmentAlreadyDeliveredError extends DomainError {
  constructor() { super('No se puede cancelar un envío ya entregado'); }
}
export class InvalidTrackingNumberError extends DomainError {
  constructor(t: string) { super(`Tracking inválido: "${t}"`); }
}
