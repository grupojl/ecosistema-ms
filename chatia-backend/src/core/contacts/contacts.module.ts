// chatia-backend/src/contacts/contacts.module.ts
import { Module }                    from "@nestjs/common";
import { ContactsController }        from "@/core/contacts/contacts.controller.js";
import { ContactsService }           from "@/core/contacts/contacts.service.js";
import { PrismaContactsRepository }  from "@/core/contacts/repository/prisma-contacts.repository.js";
import { CONTACTS_REPOSITORY }       from "@/core/contacts/repository/contacts.repository.interface.js";

@Module({
  controllers: [ContactsController],
  providers: [
    ContactsService,
    PrismaContactsRepository,
    { provide: CONTACTS_REPOSITORY, useClass: PrismaContactsRepository },
  ],
  exports: [ContactsService],
})
export class ContactsModule {}
