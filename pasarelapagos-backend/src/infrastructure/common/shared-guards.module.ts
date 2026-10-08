import { Global, Module } from '@nestjs/common';
import { FirebaseModule }      from '@/infrastructure/firebase/firebase.module.js';
import { TenantsModule }       from '@/tenants/tenants.module.js';
import { FirebaseAuthService } from '@/infrastructure/firebase/firebase-auth.service.js';
import { AuthGuard }           from '@/infrastructure/common/guards/auth.guard.js';
import { TenantGuard }         from '@/infrastructure/common/guards/tenant.guard.js';
import { ApiKeyGuard }         from '@/infrastructure/common/guards/api-key.guard.js';
import { RolesGuard }          from '@/infrastructure/common/guards/roles.guard.js';
import { WriteGuard }          from '@/infrastructure/common/guards/write.guard.js';
import { PciGuard }            from '@/infrastructure/common/guards/pci.guard.js';

@Global()
@Module({
  imports:   [FirebaseModule, TenantsModule],
  providers: [FirebaseAuthService, AuthGuard, TenantGuard, ApiKeyGuard, RolesGuard, WriteGuard, PciGuard],
  exports:   [FirebaseAuthService, AuthGuard, TenantGuard, ApiKeyGuard, RolesGuard, WriteGuard, PciGuard],
})
export class SharedGuardsModule {}
