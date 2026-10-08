import { PaymentErrorCode } from '@/infrastructure/common/errors/payment-error.catalog.js';
import { PaymentException } from '@/infrastructure/common/errors/payment.exception.js';

/**
 * Referencia: https://docs.pagar.me/reference/erros-da-api
 */
const CODE_MAP: Record<string, PaymentErrorCode> = {
  'action_forbidden':            PaymentErrorCode.CARD_DECLINED,
  'card_declined':               PaymentErrorCode.CARD_DECLINED,
  'insufficient_funds':          PaymentErrorCode.INSUFFICIENT_FUNDS,
  'expired_card':                PaymentErrorCode.CARD_EXPIRED,
  'invalid_card_number':         PaymentErrorCode.CARD_INVALID_NUMBER,
  'invalid_cvv':                 PaymentErrorCode.CARD_INVALID_CVV,
  'invalid_expiration_date':     PaymentErrorCode.CARD_INVALID_EXPIRY,
  'fraud_suspected':             PaymentErrorCode.FRAUD_SUSPECTED,
  'processing_error':            PaymentErrorCode.PROCESSING_ERROR,
  'pix_key_not_found':           PaymentErrorCode.PIX_KEY_NOT_FOUND,
  'invalid_document':            PaymentErrorCode.DOCUMENT_INVALID,
};

export function mapPagarmeError(error: unknown): never {
  const e = error as { response?: { status?: number } };
  if ((e?.response?.status ?? 0) >= 500) {
    throw new PaymentException(PaymentErrorCode.PROVIDER_UNAVAILABLE);
  }

  const pagarmeErr = error as { response?: { data?: { errors?: Array<{ message: string; type?: string; code?: string }> } } };
  const errors = pagarmeErr?.response?.data?.errors ?? [];
  const firstCode = errors[0]?.code ?? '';
  const internalCode = CODE_MAP[firstCode] ?? PaymentErrorCode.PROVIDER_UNKNOWN;
  throw new PaymentException(internalCode, errors[0]?.message);
}
