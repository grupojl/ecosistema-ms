import { Global, Module } from '@nestjs/common';
import { FirebaseModule }      from '@/modules/firebase/firebase.module.js';
import { TenantsModule }       from '@/modules/tenants/tenants.module.js';
import { FirebaseAuthService } from '@/modules/firebase/firebase-auth.service.js';
import { AuthGuard }           from '@/common/guards/auth.guard.js';
import { TenantGuard }         from '@/common/guards/tenant.guard.js';
import { ApiKeyGuard }         from '@/common/guards/api-key.guard.js';
import { RolesGuard }          from '@/common/guards/roles.guard.js';
import { WriteGuard }          from '@/common/guards/write.guard.js';
import { PciGuard }            from '@/common/guards/pci.guard.js';

@Global()
@Module({
  imports:   [FirebaseModule, TenantsModule],
  providers: [FirebaseAuthService, AuthGuard, TenantGuard, ApiKeyGuard, RolesGuard, WriteGuard, PciGuard],
  exports:   [FirebaseAuthService, AuthGuard, TenantGuard, ApiKeyGuard, RolesGuard, WriteGuard, PciGuard],
})
export class SharedGuardsModule {}
