// src/infrastructure/events/events.module.ts
import { Module } from '@nestjs/common';
import { EventsGateway } from '@/infrastructure/events/events.gateway.js';

@Module({
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
