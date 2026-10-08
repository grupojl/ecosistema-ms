import { Module } from '@nestjs/common';
import { FakeProvider } from '@/infrastructure/providers/adapters/fake/fake.provider.js';

@Module({
  providers: [FakeProvider],
})
export class FakeModule {}
