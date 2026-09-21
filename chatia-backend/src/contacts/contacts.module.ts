// chatia-backend/src/contacts/contacts.module.ts
import { Module }                    from "@nestjs/common";
import { ContactsController }        from "./contacts.controller.js";
import { ContactsService }           from "./contacts.service.js";
import { PrismaContactsRepository }  from "./repository/prisma-contacts.repository.js";
import { CONTACTS_REPOSITORY }       from "./repository/contacts.repository.interface.js";

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
