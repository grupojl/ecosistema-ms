import { Module }              from '@nestjs/common';
import { AuthController }      from '@/auth/auth.controller.js';
import { FirebaseModule }      from '@/infrastructure/firebase/firebase.module.js';
import { TenantsModule }       from '@/tenants/tenants.module.js';
import { FirebaseAuthService } from '@/infrastructure/firebase/firebase-auth.service.js';

@Module({
  imports:     [FirebaseModule, TenantsModule],
  controllers: [AuthController],
  providers:   [FirebaseAuthService],
  exports:     [FirebaseAuthService],
})
export class AuthModule {}
