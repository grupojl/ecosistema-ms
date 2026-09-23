// chatia-backend/src/contacts/contacts.module.ts
import { Module }                    from "@nestjs/common";
import { ContactsController }        from "@/contacts/contacts.controller.js";
import { ContactsService }           from "@/contacts/contacts.service.js";
import { PrismaContactsRepository }  from "@/contacts/repository/prisma-contacts.repository.js";
import { CONTACTS_REPOSITORY }       from "@/contacts/repository/contacts.repository.interface.js";

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
