// chatia-backend/src/core/contacts/contacts.module.ts
import { Module } from '@nestjs/common';
import { PrivacyModule } from '@/core/privacy/privacy.module.js';
import { ContactsService } from '@/core/contacts/contacts.service.js';

@Module({
  imports: [PrivacyModule],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
