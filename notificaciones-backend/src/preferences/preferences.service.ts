// notificaciones-backend/src/preferences/preferences.service.ts
// DT-014 fix: ecosystemId en getPreferences() para aislamiento multi-tenant
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  getPreferences(ecosystemId: string, organizationId: string, contactId: string) {
    return this.prisma.contactPreference.findMany({
      where: {
        ecosystemId,     // DT-014: filtra por ecosistema
        organizationId,
        contactId,
      },
    });
  }

  upsertPreference(
    ecosystemId:    string,
    organizationId: string,
    contactId:      string,
    channel:        'WHATSAPP' | 'EMAIL' | 'PUSH',
    optedOut:       boolean,
  ) {
    return this.prisma.contactPreference.upsert({
      where: {
        organizationId_contactId_channel: {
          organizationId,
          contactId,
          channel: channel as any,
        },
      },
      create: {
        ecosystemId,
        organizationId,
        contactId,
        channel:     channel as any,
        optedOut,
        optedOutAt:  optedOut ? new Date() : null,
      },
      update: {
        optedOut,
        optedOutAt: optedOut ? new Date() : null,
      },
    });
  }
}
