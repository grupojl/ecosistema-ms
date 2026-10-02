import { Module } from "@nestjs/common";
import { PagosGrpcController } from "@/grpc/pagos-grpc.controller.js";

@Module({ controllers: [PagosGrpcController] })
export class GrpcModule {}
