import { PaymentErrorCode } from '@/infrastructure/common/errors/payment-error.catalog.js';
import { PaymentException } from '@/infrastructure/common/errors/payment.exception.js';

/**
 * Referencia: https://docs.dlocal.com/reference/payment-error-codes
 */
const CODE_MAP: Record<number, PaymentErrorCode> = {
  300:  PaymentErrorCode.CARD_DECLINED,
  301:  PaymentErrorCode.INSUFFICIENT_FUNDS,
  302:  PaymentErrorCode.CARD_DECLINED,
  303:  PaymentErrorCode.CARD_INVALID_CVV,
  304:  PaymentErrorCode.CARD_INVALID_NUMBER,
  305:  PaymentErrorCode.CARD_EXPIRED,
  306:  PaymentErrorCode.AUTHENTICATION_REQUIRED,
  307:  PaymentErrorCode.DO_NOT_HONOR,
  309:  PaymentErrorCode.FRAUD_SUSPECTED,
  401:  PaymentErrorCode.DOCUMENT_INVALID,
  402:  PaymentErrorCode.BLACKLISTED_USER,
  500:  PaymentErrorCode.PROCESSING_ERROR,
};

export function mapDlocalError(error: unknown): never {
  const e = error as { response?: { status?: number; data?: { code?: number; message?: string } } };
  if ((e?.response?.status ?? 0) >= 500) {
    throw new PaymentException(PaymentErrorCode.PROVIDER_UNAVAILABLE);
  }
  const code      = e?.response?.data?.code ?? 500;
  const internal  = CODE_MAP[code] ?? PaymentErrorCode.PROVIDER_UNKNOWN;
  throw new PaymentException(internal, e?.response?.data?.message);
}
