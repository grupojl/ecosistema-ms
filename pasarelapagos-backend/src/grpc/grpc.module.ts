import { Module } from "@nestjs/common";
import { PagosGrpcController } from "@/grpc/pagos-grpc.controller.js";
import { PagosService } from "@/grpc/pagos.service.js";

@Module({
  controllers: [PagosGrpcController],
  providers:   [PagosService],
})
export class GrpcModule {}
