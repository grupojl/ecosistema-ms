import { Global, Module } from '@nestjs/common';
import { PiiService } from '@/common/services/pii.service';

@Global()
@Module({
  providers: [PiiService],
  exports:   [PiiService],
})
export class PiiModule {}
