// marketing-backend/src/infrastructure/adapters/adapters.module.ts
// Registra los tres adapters y los provee via tokens DI del core.
import { Module }          from "@nestjs/common";
import { MetaAdsAdapter }  from "@/infrastructure/adapters/meta/meta-ads.adapter.js";
import { GoogleAdsAdapter } from "@/infrastructure/adapters/google/google-ads.adapter.js";
import { TiktokAdsAdapter } from "@/infrastructure/adapters/tiktok/tiktok-ads.adapter.js";
import {
  META_ADS_TOKEN,
  GOOGLE_ADS_TOKEN,
  TIKTOK_ADS_TOKEN,
} from "@/core/ad-accounts/interfaces/ad-platform.tokens.js";

@Module({
  providers: [
    MetaAdsAdapter,
    GoogleAdsAdapter,
    TiktokAdsAdapter,
    { provide: META_ADS_TOKEN,   useClass: MetaAdsAdapter },
    { provide: GOOGLE_ADS_TOKEN, useClass: GoogleAdsAdapter },
    { provide: TIKTOK_ADS_TOKEN, useClass: TiktokAdsAdapter },
  ],
  exports: [META_ADS_TOKEN, GOOGLE_ADS_TOKEN, TIKTOK_ADS_TOKEN],
})
export class AdaptersModule {}
