// TODO(grpc): implementar marketing.proto cuando otro MS necesite datos de marketing
// en el hot path. Por ahora HTTP + INTERNAL_API_KEY es suficiente.
// Ref: .claude/contracts/inter-service-http.md — excepción documentada con TODO(grpc)
import { Module } from '@nestjs/common';
@Module({})
export class GrpcModule {}
