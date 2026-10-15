// Test de arranque: compila el AppModule COMPLETO y verifica que toda la inyección de dependencias resuelva.
// Los tests unitarios usan mocks y no ven errores de cableado entre módulos (un provider que falta en un
// módulo, un import circular, un servicio global mal exportado). Este test sí.
// No conecta a Postgres ni a Redis: solo `compile()` (no `init()`), así que corre sin servicios externos.
import '@/infrastructure/testing/boot-env.js'; // PRIMERO: define el entorno antes de cargar los módulos
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ModulesContainer } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module.js';
import { TenantAuthService } from '@/infrastructure/common/services/tenant-auth.service.js';
import { EventsGateway } from '@/infrastructure/events/events.gateway.js';
import { LlmService } from '@/infrastructure/providers/llm.service.js';
import { ProviderChainService } from '@/infrastructure/providers/provider-chain.service.js';
import { RateLimitService } from '@/infrastructure/security/rate-limit.service.js';
import { AutoReplyService } from '@/core/conversations/auto-reply.service.js';
import { WidgetSessionService } from '@/core/widget/widget-session.service.js';
import { ChatiaGrpcController } from '@/infrastructure/transport/grpc/chatia-grpc.controller.js';
import { FaqIndexerService } from '@/core/faq/ingestion/faq-indexer.service.js';
import { KbVectorStore } from '@/core/faq/vector/kb-vector.store.js';
import { EmbeddingService } from '@/infrastructure/common/services/embedding.service.js';
import { WidgetController } from '@/modules/common/widget/widget.controller.js';
import { WebhooksController } from '@/modules/common/webhooks/webhooks.controller.js';
import { HealthController } from '@/infrastructure/transport/health/health.controller.js';

describe('AppModule — arranque (inyección de dependencias)', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  }, 60_000);

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('el módulo compila sin errores de dependencias', () => {
    expect(moduleRef).toBeDefined();
  });

  it('TODOS los controllers del código están montados en la app (antes contacts, agents, projects, ai-config, messages y dlq daban 404)', () => {
    const declared = new Set<string>();
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (name === 'generated' || name === 'node_modules') continue;
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.controller.ts')) {
          for (const m of readFileSync(full, 'utf8').matchAll(
            new RegExp('export class ([A-Za-z0-9_]+Controller)', 'g'),
          ))
            declared.add(m[1]!);
        }
      }
    };
    walk(join(__dirname, '..', '..'));

    expect(declared.size).toBeGreaterThan(15); // el escaneo encontró los controllers (no pasa en vacío)

    const mounted = new Set<string>();
    for (const mod of moduleRef
      .get(ModulesContainer, { strict: false })
      .values()) {
      for (const ctl of mod.controllers.values())
        mounted.add(ctl.metatype?.name ?? '');
    }

    const missing = [...declared].filter((name) => !mounted.has(name));
    expect(missing).toEqual([]);
  });

  it.each([
    ['TenantAuthService', TenantAuthService],
    ['EventsGateway', EventsGateway],
    ['LlmService', LlmService],
    ['ProviderChainService', ProviderChainService],
    ['RateLimitService', RateLimitService],
    ['AutoReplyService', AutoReplyService],
    ['WidgetSessionService', WidgetSessionService],
    ['ChatiaGrpcController', ChatiaGrpcController],
    ['FaqIndexerService', FaqIndexerService],
    ['KbVectorStore', KbVectorStore],
    ['EmbeddingService', EmbeddingService],
    ['WidgetController', WidgetController],
    ['WebhooksController', WebhooksController],
    ['HealthController', HealthController],
  ])('resuelve %s', (_name, token) => {
    expect(() =>
      moduleRef.get(token as never, { strict: false }),
    ).not.toThrow();
  });
});
