import { Module }              from "@nestjs/common";
import { AdAccountsController } from "@/ad-accounts/ad-accounts.controller.js";
import { AdAccountsModule as CoreAdAccountsModule } from "@/core/ad-accounts/ad-accounts.module.js";

@Module({
  imports:     [CoreAdAccountsModule],
  controllers: [AdAccountsController],
})
export class AdAccountsModule {}
