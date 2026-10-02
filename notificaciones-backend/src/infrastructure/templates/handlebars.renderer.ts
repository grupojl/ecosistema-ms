// notificaciones-backend/src/infrastructure/templates/handlebars.renderer.ts
// Implementación concreta del motor de templates.
// El core no sabe que esto existe — solo conoce ITemplateRenderer via token.
import { Injectable }    from "@nestjs/common";
import type { ITemplateRenderer } from "@/infrastructure/contracts/template-renderer.interface.js";
import type { TemplateId, TemplateData } from "@/core/notifications/domain/notification-template.types.js";

@Injectable()
export class HandlebarsRenderer implements ITemplateRenderer {
  async render(templateId: TemplateId, data: TemplateData): Promise<string> {
    // TODO: implementar con Handlebars/MJML
    return `[${templateId}] ${JSON.stringify(data)}`;
  }
}
