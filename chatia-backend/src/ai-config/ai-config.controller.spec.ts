import { Test, TestingModule } from '@nestjs/testing';
import { AiConfigController } from '@/core/ai-config/ai-config.controller.js';
import { AiConfigService } from '@/core/ai-config/ai-config.service.js';

describe('AiConfigController', () => {
  let controller: AiConfigController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiConfigController],
      providers: [AiConfigService],
    }).compile();

    controller = module.get<AiConfigController>(AiConfigController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
