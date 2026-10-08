import { Module } from "@nestjs/common";
import { OverviewModule } from "@/core/overview/overview.module.js";
import { AnalyticsGrpcController } from "@/grpc/analytics-grpc.controller.js";
@Module({ imports: [OverviewModule], controllers: [AnalyticsGrpcController] })
export class GrpcModule {}
