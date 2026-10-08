import { Module } from "@nestjs/common";
import { AdAccountsModule as CoreAdAccountsModule } from "@/core/ad-accounts/ad-accounts.module.js";

// El controller lo declara el módulo core (evita rutas duplicadas).
@Module({
  imports: [CoreAdAccountsModule],
  exports: [CoreAdAccountsModule],
})
export class AdAccountsModule {}
