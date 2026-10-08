import { Test, TestingModule } from '@nestjs/testing';
import { ContactsController } from '@/core/contacts/contacts.controller.js';
import { ContactsService } from '@/core/contacts/contacts.service.js';

describe('ContactsController', () => {
  let controller: ContactsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [ContactsService],
    }).compile();

    controller = module.get<ContactsController>(ContactsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
