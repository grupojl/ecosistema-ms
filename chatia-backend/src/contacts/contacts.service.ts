// chatia-backend/src/contacts/contacts.service.ts
// FIX-02: refactorizado para usar IContactsRepository via @Inject.
// PrismaService eliminado — toda la persistencia va por el repository.
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CONTACTS_REPOSITORY,
  type IContactsRepository,
} from '@/contacts/repository/contacts.repository.interface.js';
import { assertNoDuplicateTags, ContactNotFoundError } from '@/contacts/domain/contact.errors.js';
import type { UpdateContactDto }   from '@/contacts/dto/update-contact.dto.js';
import type { ListContactsFilter } from '@/contacts/repository/contacts.repository.interface.js';

@Injectable()
export class ContactsService {
  constructor(
    @Inject(CONTACTS_REPOSITORY)
    private readonly contactsRepository: IContactsRepository,
  ) {}

  async list(organizationId: string, filters?: ListContactsFilter) {
    const contacts = await this.contactsRepository.list(organizationId, filters);
    return { success: true, data: contacts };
  }

  async getOne(contactId: string, organizationId: string) {
    const contact = await this.contactsRepository.findOne(contactId, organizationId);
    if (!contact) {
      throw new NotFoundException(
        new ContactNotFoundError(contactId, organizationId).message,
      );
    }
    return { success: true, data: contact };
  }

  async update(
    contactId:      string,
    organizationId: string,
    dto: UpdateContactDto,
  ) {
    // Validar invariante de dominio: tags sin duplicados
    if (dto.tags) {
      try {
        assertNoDuplicateTags(dto.tags);
      } catch (err) {
        throw new UnprocessableEntityException(
          err instanceof Error ? err.message : 'Tags inválidos',
        );
      }
    }

    const updated = await this.contactsRepository.update(contactId, organizationId, {
      ...(dto.name     !== undefined && { name:     dto.name }),
      ...(dto.email    !== undefined && { email:    dto.email }),
      ...(dto.status   !== undefined && { status:   dto.status }),
      ...(dto.tags     !== undefined && { tags:     dto.tags }),
      ...(dto.optedOut !== undefined && { optedOut: dto.optedOut }),
    });
    return { success: true, data: updated };
  }

  async getStats(organizationId: string) {
    const stats = await this.contactsRepository.getStats(organizationId);
    return { success: true, data: stats };
  }
}
