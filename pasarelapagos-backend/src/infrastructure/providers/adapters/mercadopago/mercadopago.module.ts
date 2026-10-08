import { Module } from '@nestjs/common';
import { MercadoPagoProvider } from '@/infrastructure/providers/adapters/mercadopago/mercadopago.provider.js';

@Module({
  providers: [MercadoPagoProvider],
  exports: [MercadoPagoProvider],
})
export class MercadoPagoModule {}
