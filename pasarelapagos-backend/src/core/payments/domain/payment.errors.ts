// pasarelapagos-backend/src/modules/payments/domain/payment.errors.ts

export class PaymentNotFoundError extends Error {
  constructor(paymentId: string) {
    super(`Payment not found: ${paymentId}`);
    this.name = 'PaymentNotFoundError';
  }
}

export class PaymentAccessDeniedError extends Error {
  constructor(paymentId: string, organizationId: string) {
    super(`Payment ${paymentId} does not belong to org ${organizationId}`);
    this.name = 'PaymentAccessDeniedError';
  }
}

export class PaymentDuplicateError extends Error {
  constructor(idempotencyKey: string) {
    super(`Duplicate payment with idempotencyKey: ${idempotencyKey}`);
    this.name = 'PaymentDuplicateError';
  }
}

export class ProviderUnavailableError extends Error {
  constructor(provider: string) {
    super(`Payment provider unavailable: ${provider}`);
    this.name = 'ProviderUnavailableError';
  }
}
