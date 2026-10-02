import { BullModule }           from '@nestjs/bullmq';
import { Module }               from '@nestjs/common';
import { WebhooksController }   from '@/modules/webhooks/webhooks.controller.js';
import { WebhookProcessor }     from '@/modules/webhooks/webhook.processor.js';
import { WebhookSecretService } from '@/modules/webhooks/webhook-secret.service.js';
import { FirebaseModule }       from '@/firebase/firebase.module.js';
import { TenantsModule }        from '@/tenants/tenants.module.js';
import { FirebaseAuthService }  from '@/firebase/firebase-auth.service.js';
import { AuthGuard }            from '@/common/guards/auth.guard.js';
import { TenantGuard }          from '@/common/guards/tenant.guard.js';
import { ApiKeyGuard }          from '@/common/guards/api-key.guard.js';
import { RolesGuard }           from '@/common/guards/roles.guard.js';
import { QUEUE_WEBHOOKS }       from '@/common/constants/queues.js';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';

@Module({
  imports: [
    FirebaseModule,
    TenantsModule,
    ...(REDIS_ENABLED ? [BullModule.registerQueue({ name: QUEUE_WEBHOOKS })] : []),
  ],
  controllers: REDIS_ENABLED ? [WebhooksController] : [],
  providers: [
    WebhookSecretService,
    FirebaseAuthService,
    AuthGuard,
    TenantGuard,
    ApiKeyGuard,
    RolesGuard,
    ...(REDIS_ENABLED ? [WebhookProcessor] : []),
  ],
  exports: [WebhookSecretService],
})
export class WebhooksModule {}
