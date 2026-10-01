import { Module }              from '@nestjs/common';
import { AuthController }      from '@/modules/auth/auth.controller.js';
import { FirebaseModule }      from '@/firebase/firebase.module.js';
import { TenantsModule }       from '@/tenants/tenants.module.js';
import { FirebaseAuthService } from '@/firebase/firebase-auth.service.js';

@Module({
  imports:     [FirebaseModule, TenantsModule],
  controllers: [AuthController],
  providers:   [FirebaseAuthService],
  exports:     [FirebaseAuthService],
})
export class AuthModule {}
