// src/infrastructure/firebase/firebase.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App | null = null;

  onModuleInit() {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase Admin no configurado — FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y ' +
        'FIREBASE_PRIVATE_KEY son requeridas. El TenantGuard fallará si se usa Firebase auth.',
      );
      return;
    }

    // Evitar inicializar dos veces (hot reload en dev)
    const existing = getApps()[0];
    if (existing) {
      this.app = existing;
      this.logger.log('Firebase Admin reutilizado');
      return;
    }

    this.app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log(`Firebase Admin inicializado — proyecto: ${projectId}`);
  }

  async verifyIdToken(token: string): Promise<DecodedIdToken> {
    if (!this.app) throw new Error('Firebase Admin no inicializado');
    return getAuth(this.app).verifyIdToken(token, true);
  }

  get isInitialized(): boolean {
    return this.app !== null;
  }
}
