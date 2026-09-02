// pasarelapagos-backend/src/modules/payments/domain/payment.entity.ts
//
// Entidad de dominio pura — sin NestJS ni Prisma.
// Los estados de pago son invariantes de dominio críticos.
//
// Invariantes:
//   - COMPLETED es terminal — no puede transicionar a ningún otro estado
//   - Solo PENDING puede ir a AUTHORIZED
//   - Solo AUTHORIZED puede ir a CAPTURED o FAILED
//   - Solo CAPTURED puede ir a REFUNDED

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentMethodKind =
  | 'card'
  | 'wallet'
  | 'bank_transfer'
  | 'cash_voucher'
  | 'pix'
  | 'qr';

export interface Payment {
  readonly id:             string;
  readonly tenantId:       string;   // ecosystemId
  readonly organizationId: string;
  readonly amountMinor:    bigint;   // en unidades mínimas (centavos)
  readonly currency:       string;   // ISO-4217
  readonly country:        string;   // ISO-3166-1 alpha-2
  readonly method:         PaymentMethodKind;
  readonly status:         PaymentStatus;
  readonly providerId:     string;   // 'stripe' | 'mercadopago' | etc.
  readonly externalId:     string | null;
  readonly description:    string | null;
  readonly metadata:       Record<string, string>;
  readonly failureCode:    string | null;
  readonly failureMessage: string | null;
  readonly idempotencyKey: string;
  readonly customerId:     string | null;
  readonly createdAt:      Date;
  readonly updatedAt:      Date;
}

// ── Transiciones válidas ────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING:    ['AUTHORIZED', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['CAPTURED', 'FAILED', 'CANCELLED'],
  CAPTURED:   ['REFUNDED'],
  FAILED:     [],
  CANCELLED:  [],
  REFUNDED:   [],
};

export function assertValidTransition(
  from: PaymentStatus,
  to:   PaymentStatus,
): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new PaymentTransitionError(from, to);
  }
}

export class PaymentTransitionError extends Error {
  constructor(from: PaymentStatus, to: PaymentStatus) {
    super(`Invalid payment transition: ${from} → ${to}`);
    this.name = 'PaymentTransitionError';
  }
}
