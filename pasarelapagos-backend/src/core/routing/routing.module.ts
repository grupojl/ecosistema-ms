import { Module }          from "@nestjs/common";
import { RoutingService }  from "@/core/routing/routing.service.js";

@Module({
  providers: [RoutingService],
  exports:   [RoutingService],
})
export class RoutingModule {}
