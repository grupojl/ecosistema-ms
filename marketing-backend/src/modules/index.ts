// marketing-backend/src/modules/index.ts
// Módulo raíz de ecosistemas — solo welver, manzana, mexus.
import { Module }        from "@nestjs/common";
import { WelverModule }  from "@/modules/welver/welver.module.js";
import { ManzanaModule } from "@/modules/manzana/manzana.module.js";
import { MexusModule }   from "@/modules/mexus/mexus.module.js";

@Module({ imports: [WelverModule, ManzanaModule, MexusModule] })
export class MarketingModulesModule {}

export { WelverModule, ManzanaModule, MexusModule };
