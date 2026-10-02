import { Module } from '@nestjs/common';
import { ConektaProvider } from '@/modules/providers/adapters/conekta/conekta.provider.js';

@Module({
  providers: [ConektaProvider],
  exports: [ConektaProvider],
})
export class ConektaModule {}
