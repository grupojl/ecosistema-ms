export abstract class DomainError extends Error {
  constructor(message: string) { super(message); this.name = this.constructor.name; }
}
export class DeliveryAlreadyCancelledError extends DomainError { constructor() { super('Delivery ya cancelado'); } }
export class DeliveryAlreadyDeliveredError extends DomainError { constructor() { super('No se puede cancelar un delivery entregado'); } }
export class MissingOriginError extends DomainError { constructor() { super('El origen del delivery es requerido'); } }
