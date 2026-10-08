import { BullModule }           from '@nestjs/bullmq';
import { Module }               from '@nestjs/common';
import { WebhooksController }   from '@/webhooks/webhooks.controller.js';
import { WebhookProcessor }     from '@/webhooks/webhook.processor.js';
import { WebhookSecretService } from '@/webhooks/webhook-secret.service.js';
import { FirebaseModule }       from '@/infrastructure/firebase/firebase.module.js';
import { TenantsModule }        from '@/tenants/tenants.module.js';
import { FirebaseAuthService }  from '@/infrastructure/firebase/firebase-auth.service.js';
import { AuthGuard }            from '@/infrastructure/common/guards/auth.guard.js';
import { TenantGuard }          from '@/infrastructure/common/guards/tenant.guard.js';
import { ApiKeyGuard }          from '@/infrastructure/common/guards/api-key.guard.js';
import { RolesGuard }           from '@/infrastructure/common/guards/roles.guard.js';
import { QUEUE_WEBHOOKS }       from '@/infrastructure/common/constants/queues.js';

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
