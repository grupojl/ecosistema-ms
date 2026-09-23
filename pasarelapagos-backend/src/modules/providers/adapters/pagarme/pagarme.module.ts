import { Module } from '@nestjs/common';
import { PagarmeProvider } from '@/modules/providers/adapters/pagarme/pagarme.provider';

@Module({
  providers: [PagarmeProvider],
  exports: [PagarmeProvider],
})
export class PagarmeModule {}
