import { Module }          from "@nestjs/common";
import { PagosService }    from "@/pagos/pagos.service";
import { PagosController } from "@/pagos/pagos.controller";
import { PagosGrpcController } from "@/pagos/pagos.grpc.controller";

@Module({
  controllers: [PagosController, PagosGrpcController],
  providers:   [PagosService],
})
export class PagosModule {}
