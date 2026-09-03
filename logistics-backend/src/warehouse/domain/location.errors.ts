export abstract class DomainError extends Error { constructor(message: string) { super(message); this.name = this.constructor.name; } }
export class LocationInactiveError extends DomainError { constructor(id: string) { super(`Ubicación ${id} inactiva`); } }
export class InsufficientStockError extends DomainError { constructor(v: string, req: number, avail: number) { super(`Stock insuficiente para ${v}: solicitado ${req}, disponible ${avail}`); } }
export class DuplicateLocationCodeError extends DomainError { constructor(code: string) { super(`Código de ubicación "${code}" ya existe`); } }
