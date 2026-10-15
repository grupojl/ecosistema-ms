// src/infrastructure/common/common.module.ts
//
// Módulo global — exporta servicios comunes y EcosystemModule.
// Al ser @Global() + exportar EcosystemModule, EcosystemService queda
// disponible en TODOS los módulos sin necesidad de importarlo individualmente.
// Esto es necesario porque TenantGuard inyecta EcosystemService y se usa
// en controllers de múltiples módulos.
import { GroqModule } from '@/infrastructure/groq/groq.module.js';
import { Global, Module } from '@nestjs/common';
import { EmbeddingService } from '@/infrastructure/common/services/embedding.service.js';
import { CacheService } from '@/infrastructure/common/services/cache.service.js';
import { CircuitBreakerService } from '@/infrastructure/common/services/circuit-breaker.service.js';
import { EcosystemModule } from '@/core/ecosystem/ecosystem.module.js';
import { ProvidersModule } from '@/infrastructure/providers/providers.module.js';
import { TenantAuthService } from '@/infrastructure/common/services/tenant-auth.service.js';

@Global()
@Module({
  imports: [GroqModule, ProvidersModule, EcosystemModule],
  providers: [
    EmbeddingService,
    CacheService,
    CircuitBreakerService,
    TenantAuthService,
  ],
  exports: [
    EmbeddingService,
    CacheService,
    CircuitBreakerService,
    TenantAuthService,
    EcosystemModule,
  ],
})
export class CommonModule {}
