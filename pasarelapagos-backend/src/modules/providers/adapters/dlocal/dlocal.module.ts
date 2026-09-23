import { Module } from '@nestjs/common';
import { DlocalProvider } from '@/modules/providers/adapters/dlocal/dlocal.provider';

@Module({
  providers: [DlocalProvider],
  exports: [DlocalProvider],
})
export class DlocalModule {}
