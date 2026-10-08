import { Global, Module } from '@nestjs/common';
import { AuditService } from '@/infrastructure/audit/audit.service.js';

@Global()
@Module({
  providers: [AuditService],
  exports:   [AuditService],
})
export class AuditModule {}
