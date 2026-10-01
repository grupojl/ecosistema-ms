// src/events/events.module.ts
import { Module } from '@nestjs/common';
import { EventsGateway } from '@/events/events.gateway.js';

@Module({
  providers: [EventsGateway],
  exports: [EventsGateway],
})
