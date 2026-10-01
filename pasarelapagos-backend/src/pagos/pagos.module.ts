import { Module }          from "@nestjs/common";
import { PagosService }    from "@/pagos/pagos.service.js";
import { PagosController } from "@/pagos/pagos.controller.js";
import { PagosGrpcController } from "@/pagos/pagos.grpc.controller.js";

@Module({
  controllers: [PagosController, PagosGrpcController],
  providers:   [PagosService],
})
export class PagosModule {}
