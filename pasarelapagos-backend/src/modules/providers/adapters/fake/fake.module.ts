import { Module } from '@nestjs/common';
import { FakeProvider } from '@/modules/providers/adapters/fake/fake.provider.js';

@Module({
  providers: [FakeProvider],
})
export class FakeModule {}
