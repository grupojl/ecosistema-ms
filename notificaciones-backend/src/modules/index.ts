// notificaciones-backend/src/modules/index.ts
// Módulo raíz de ecosistemas.
// app.module.ts importa solo NotificacionesModulesModule.
import { Module }        from "@nestjs/common";
import { WelverNotifModule }  from "@/modules/welver/welver.module.js";
import { ManzanaNotifModule } from "@/modules/manzana/manzana.module.js";
import { MexusNotifModule }   from "@/modules/mexus/mexus.module.js";

@Module({ imports: [WelverNotifModule, ManzanaNotifModule, MexusNotifModule] })
export class NotificacionesModulesModule {}

export { WelverNotifModule, ManzanaNotifModule, MexusNotifModule };
