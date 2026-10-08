import { Global, Module } from '@nestjs/common';
import { PiiService } from '@/infrastructure/common/services/pii.service.js';

@Global()
@Module({
  providers: [PiiService],
  exports:   [PiiService],
})
export class PiiModule {}
