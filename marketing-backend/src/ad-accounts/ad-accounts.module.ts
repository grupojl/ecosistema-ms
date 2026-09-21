import { Module }             from '@nestjs/common';
import { MetaAdsAdapter }     from './adapters/meta-ads.adapter.js';
import { AD_PLATFORM_TOKENS } from './adapters/ad-platform.interface.js';
import { AdAccountsService }  from './ad-accounts.service.js';
import { AdAccountsController } from './ad-accounts.controller.js';

@Module({
  providers: [
    AdAccountsService,
    { provide: AD_PLATFORM_TOKENS.META, useClass: MetaAdsAdapter },
    // TODO(phase2): { provide: AD_PLATFORM_TOKENS.GOOGLE, useClass: GoogleAdsAdapter }
    // TODO(phase2): { provide: AD_PLATFORM_TOKENS.TIKTOK, useClass: TikTokAdsAdapter }
  ],
  controllers: [AdAccountsController],
  exports: [AdAccountsService, AD_PLATFORM_TOKENS.META],
})
export class AdAccountsModule {}
