import { Module } from '@nestjs/common';
import { DlocalProvider } from '@/infrastructure/providers/adapters/dlocal/dlocal.provider.js';

@Module({
  providers: [DlocalProvider],
  exports: [DlocalProvider],
})
export class DlocalModule {}
