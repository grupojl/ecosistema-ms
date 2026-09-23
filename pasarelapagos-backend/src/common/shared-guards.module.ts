import { Global, Module } from '@nestjs/common';
import { FirebaseModule }      from '@/modules/firebase/firebase.module';
import { TenantsModule }       from '@/modules/tenants/tenants.module';
import { FirebaseAuthService } from '@/modules/firebase/firebase-auth.service';
import { AuthGuard }           from '@/common/guards/auth.guard';
import { TenantGuard }         from '@/common/guards/tenant.guard';
import { ApiKeyGuard }         from '@/common/guards/api-key.guard';
import { RolesGuard }          from '@/common/guards/roles.guard';
import { WriteGuard }          from '@/common/guards/write.guard';
import { PciGuard }            from '@/common/guards/pci.guard';

@Global()
@Module({
  imports:   [FirebaseModule, TenantsModule],
  providers: [FirebaseAuthService, AuthGuard, TenantGuard, ApiKeyGuard, RolesGuard, WriteGuard, PciGuard],
  exports:   [FirebaseAuthService, AuthGuard, TenantGuard, ApiKeyGuard, RolesGuard, WriteGuard, PciGuard],
})
export class SharedGuardsModule {}
