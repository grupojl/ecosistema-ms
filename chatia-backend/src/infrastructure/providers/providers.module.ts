// src/infrastructure/providers/providers.module.ts
//
// Global: ProviderChainService y LlmService disponibles en todos los módulos.
// Depende de CircuitBreakerService (exportado por CommonModule, también global).
import { Global, Module } from '@nestjs/common';
import { ProviderChainService } from '@/infrastructure/providers/provider-chain.service.js';
import { LlmService } from '@/infrastructure/providers/llm.service.js';

@Global()
@Module({
  providers: [ProviderChainService, LlmService],
  exports: [ProviderChainService, LlmService],
})
export class ProvidersModule {}
