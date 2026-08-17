import { Module }          from "@nestjs/common";
import { PagosService }    from "./pagos.service";
import { PagosController } from "./pagos.controller";
import { PagosGrpcController } from "./pagos.grpc.controller";

@Module({
  controllers: [PagosController, PagosGrpcController],
  providers:   [PagosService],
})
export class PagosModule {}
