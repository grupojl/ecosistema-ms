import { normalizeWhatsAppRecipient } from '@/infrastructure/channels/whatsapp/phone-normalization.js';

describe('normalizeWhatsAppRecipient', () => {
  it('Argentina: quita el 9 de móviles (549… → 54…)', () => {
    expect(normalizeWhatsAppRecipient('5493835117701')).toBe('543835117701');
  });

  it('México: quita el 1 de móviles (521… → 52…)', () => {
    expect(normalizeWhatsAppRecipient('5215512345678')).toBe('525512345678');
  });

  it('no toca números ya normalizados ni de otros países', () => {
    expect(normalizeWhatsAppRecipient('543835117701')).toBe('543835117701');
    expect(normalizeWhatsAppRecipient('14155550123')).toBe('14155550123');
    expect(normalizeWhatsAppRecipient('5511987654321')).toBe('5511987654321');
  });

  it('no toca ids que no son teléfonos ni longitudes distintas', () => {
    expect(normalizeWhatsAppRecipient('549')).toBe('549');
    expect(normalizeWhatsAppRecipient('54938351177011')).toBe('54938351177011');
  });
});
