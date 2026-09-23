import { Module } from '@nestjs/common';
import { FakeProvider } from '@/modules/providers/adapters/fake/fake.provider';

@Module({
  providers: [FakeProvider],
})
export class FakeModule {}
