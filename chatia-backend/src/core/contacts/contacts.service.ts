// chatia-backend/src/core/contacts/contacts.service.ts
// FIX-02: usa IContactsRepository via @Inject.
// C5 fix: ecosystemId en todas las operaciones para aislamiento multi-tenant.
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CONTACTS_REPOSITORY,
  type IContactsRepository,
  type ListContactsFilter,
} from '@/core/contacts/repository/contacts.repository.interface.js';
import { assertNoDuplicateTags } from '@/core/contacts/domain/contact.entity.js';
import { ContactInvalidTagsError, ContactNotFoundError } from '@/core/contacts/domain/contact.errors.js';
import type { UpdateContactInput } from '@/core/contacts/schemas.js';

@Injectable()
export class ContactsService {
  constructor(
    @Inject(CONTACTS_REPOSITORY)
    private readonly contactsRepository: IContactsRepository,
  ) {}

  async list(organizationId: string, ecosystemId: string, filters?: ListContactsFilter) {
    const { data, total, page, limit } =
      await this.contactsRepository.list(organizationId, ecosystemId, filters);
    return {
      success: true,
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(contactId: string, organizationId: string, ecosystemId: string) {
    const contact = await this.contactsRepository.findOne(contactId, organizationId, ecosystemId);
    if (!contact) {
      throw new NotFoundException(new ContactNotFoundError(contactId, organizationId).message);
    }
    return { success: true, data: contact };
  }

  async update(
    contactId:      string,
    organizationId: string,
    ecosystemId:    string,
    dto:            UpdateContactInput,
  ) {
    if (dto.tags) {
      try {
        assertNoDuplicateTags(dto.tags);
      } catch (err) {
        if (err instanceof ContactInvalidTagsError) {
          throw new UnprocessableEntityException(err.message);
        }
        throw err;
      }
    }

    const updated = await this.contactsRepository.update(contactId, organizationId, ecosystemId, dto);
    if (!updated) {
      throw new NotFoundException(new ContactNotFoundError(contactId, organizationId).message);
    }
    return { success: true, data: updated };
  }

  async getStats(organizationId: string, ecosystemId: string) {
    const stats = await this.contactsRepository.getStats(organizationId, ecosystemId);
    return { success: true, data: stats };
  }
}
