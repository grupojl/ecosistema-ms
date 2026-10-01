// src/widget/widget.module.ts
import { Module } from '@nestjs/common';
import { WidgetController } from '@/widget/widget.controller.js';
import { AssistantModule } from '@/assistant/assistant.module.js';

@Module({
  imports: [AssistantModule],
  controllers: [WidgetController],
})
export class WidgetModule {}
