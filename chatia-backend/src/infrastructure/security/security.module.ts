// src/infrastructure/security/security.module.ts
import { Global, Module } from '@nestjs/common';
import { RateLimitService } from '@/infrastructure/security/rate-limit.service.js';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';

@Global()
@Module({
  providers: [
    RateLimitService,
    { provide: TokenCipher, useFactory: () => TokenCipher.fromEnv() },
  ],
  exports: [RateLimitService, TokenCipher],
})
export class SecurityModule {}
