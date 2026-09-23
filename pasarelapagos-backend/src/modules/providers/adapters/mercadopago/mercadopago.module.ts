import { Module } from '@nestjs/common';
import { MercadoPagoProvider } from '@/modules/providers/adapters/mercadopago/mercadopago.provider';

@Module({
  providers: [MercadoPagoProvider],
  exports: [MercadoPagoProvider],
})
export class MercadoPagoModule {}
