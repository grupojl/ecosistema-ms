// pasarelapagos-backend/src/modules/index.ts
// Módulo raíz de ecosistemas.
// app.module.ts importa solo PasarelaModulesModule.
import { Module }        from "@nestjs/common";
import { WelverPaymentModule }  from "@/modules/welver/welver.module.js";
import { ManzanaPaymentModule } from "@/modules/manzana/manzana.module.js";
import { MexusPaymentModule }   from "@/modules/mexus/mexus.module.js";

@Module({ imports: [WelverPaymentModule, ManzanaPaymentModule, MexusPaymentModule] })
export class PasarelaModulesModule {}

export { WelverPaymentModule, ManzanaPaymentModule, MexusPaymentModule };
