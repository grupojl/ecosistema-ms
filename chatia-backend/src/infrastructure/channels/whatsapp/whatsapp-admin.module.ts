// src/infrastructure/channels/whatsapp/whatsapp-admin.module.ts
// Enlaza el puerto de administración de WhatsApp (core/channel-accounts) con su implementación HTTP.
// @Global: core/ inyecta WHATSAPP_GRAPH sin importar infrastructure/ (igual que los repositorios en PrismaModule).
import { Global, Module } from '@nestjs/common';
import { WHATSAPP_GRAPH } from '@/core/channel-accounts/whatsapp-graph.port.js';
import { WhatsAppGraphClient } from '@/infrastructure/channels/whatsapp/whatsapp-graph.client.js';

@Global()
@Module({
  providers: [{ provide: WHATSAPP_GRAPH, useClass: WhatsAppGraphClient }],
  exports: [WHATSAPP_GRAPH],
})
export class WhatsAppAdminModule {}
