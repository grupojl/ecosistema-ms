// src/core/widget/widget.module.ts
import { Module } from '@nestjs/common';
import { WidgetConfigService } from '@/core/widget/widget-config.service.js';
import { WidgetSessionService } from '@/core/widget/widget-session.service.js';
import { AssistantModule } from '@/core/assistant/assistant.module.js';

@Module({
  imports: [AssistantModule],
  providers: [WidgetSessionService, WidgetConfigService],
  exports: [WidgetSessionService, WidgetConfigService],
})
export class WidgetModule {}
