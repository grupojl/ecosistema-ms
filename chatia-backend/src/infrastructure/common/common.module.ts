// src/common/common.module.ts
//
// Módulo global — exporta servicios comunes y EcosystemModule.
// Al ser @Global() + exportar EcosystemModule, EcosystemService queda
// disponible en TODOS los módulos sin necesidad de importarlo individualmente.
// Esto es necesario porque TenantGuard inyecta EcosystemService y se usa
// en controllers de múltiples módulos.
import { Global, Module } from '@nestjs/common';
import { EmbeddingService } from '@/infrastructure/common/services/embedding.service.js';
import { CacheService }     from '@/infrastructure/common/services/cache.service.js';
import { CircuitBreakerService } from '@/infrastructure/common/services/circuit-breaker.service.js';
import { EcosystemModule }  from '@/core/ecosystem/ecosystem.module.js';
import { GroqModule }       from '@/infrastructure/groq/groq.module.js';

@Global()
@Module({
  imports:   [GroqModule, EcosystemModule],
  providers: [EmbeddingService, CacheService, CircuitBreakerService],
  exports:   [EmbeddingService, CacheService, CircuitBreakerService, EcosystemModule],
})
export class CommonModule {}
