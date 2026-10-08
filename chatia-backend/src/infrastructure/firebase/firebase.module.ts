// src/firebase/firebase.module.ts
import { Global, Module } from '@nestjs/common';
import { FirebaseService } from '@/infrastructure/firebase/firebase.service.js';

@Global()
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
