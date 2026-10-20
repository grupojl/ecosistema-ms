// src/infrastructure/channels/whatsapp/phone-normalization.ts
// El webhook de WhatsApp entrega algunos móviles con un prefijo que la API de envío rechaza (#131030, "not in allowed
// list") si no coincide con el número registrado. Tabla explícita por país: Meta es quien define estas excepciones,
// una librería de teléfonos genérica no las conoce. Agregar un país = una fila + su caso en el spec.
const SEND_FORMAT_RULES: ReadonlyArray<{
  pattern: RegExp;
  replacement: string;
}> = [
  // Argentina: 549 + 10 dígitos → 54 + 10 dígitos (sin el 9 de móviles)
  { pattern: /^549(\d{10})$/, replacement: '54$1' },
  // México: 521 + 10 dígitos → 52 + 10 dígitos (sin el 1 de móviles)
  { pattern: /^521(\d{10})$/, replacement: '52$1' },
];

export function normalizeWhatsAppRecipient(to: string): string {
  for (const { pattern, replacement } of SEND_FORMAT_RULES) {
    if (pattern.test(to)) return to.replace(pattern, replacement);
  }
  return to;
}
