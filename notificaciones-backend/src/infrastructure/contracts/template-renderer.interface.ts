// notificaciones-backend/src/infrastructure/contracts/template-renderer.interface.ts
// Interface que infrastructure/templates/ implementa.
// Exportada desde infrastructure/contracts/ para que el core pueda referenciarla
// sin crear una dependencia circular.
import type { TemplateId, TemplateData } from "@/core/notifications/domain/notification-template.types.js";

export interface ITemplateRenderer {
  render(templateId: TemplateId, data: TemplateData): Promise<string>;
}
