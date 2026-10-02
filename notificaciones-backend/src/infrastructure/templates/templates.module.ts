import { Module }              from "@nestjs/common";
import { HandlebarsRenderer }  from "@/infrastructure/templates/handlebars.renderer.js";
import { NS_TEMPLATE_RENDERER_TOKEN } from "@/core/notifications/interfaces/channel-tokens.js";

@Module({
  providers: [
    { provide: NS_TEMPLATE_RENDERER_TOKEN, useClass: HandlebarsRenderer },
    HandlebarsRenderer,
  ],
  exports: [NS_TEMPLATE_RENDERER_TOKEN],
})
export class TemplatesModule {}
