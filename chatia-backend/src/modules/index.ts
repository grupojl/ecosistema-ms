// chatia-backend/src/modules/index.ts
// Módulo raíz de ecosistemas.
// app.module.ts importa solo ChatiaModulesModule.
// Agregar un ecosistema nuevo: añadir el módulo aquí — sin tocar app.module.ts.
import { Module }        from "@nestjs/common";
import { WelverModule }  from "@/modules/welver/welver.module.js";
import { ManzanaModule } from "@/modules/manzana/manzana.module.js";
import { MexusModule }   from "@/modules/mexus/mexus.module.js";

@Module({
  imports: [WelverModule, ManzanaModule, MexusModule],
})
export class ChatiaModulesModule {}

export { WelverModule, ManzanaModule, MexusModule };
