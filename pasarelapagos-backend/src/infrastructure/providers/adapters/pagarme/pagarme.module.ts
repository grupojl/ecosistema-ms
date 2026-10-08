import { Module } from '@nestjs/common';
import { PagarmeProvider } from '@/infrastructure/providers/adapters/pagarme/pagarme.provider.js';

@Module({
  providers: [PagarmeProvider],
  exports: [PagarmeProvider],
})
export class PagarmeModule {}
