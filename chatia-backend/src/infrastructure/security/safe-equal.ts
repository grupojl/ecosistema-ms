// src/infrastructure/security/safe-equal.ts
//
// Comparación de secretos en tiempo constante (evita ataques por temporización).
// Se hashea antes de comparar para que la longitud tampoco se filtre.
import { createHash, timingSafeEqual } from 'node:crypto';

export function safeEqual(
  received: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  if (!received || !expected) return false;
  const a = createHash('sha256').update(received).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
