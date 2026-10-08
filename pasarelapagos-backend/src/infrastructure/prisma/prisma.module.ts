import { Global, Module } from "@nestjs/common";
import { PrismaService }  from "@/infrastructure/prisma/prisma.service.js";

@Global()
@Module({
  providers: [PrismaService],
  exports:   [PrismaService],
})
export class PrismaModule {}
