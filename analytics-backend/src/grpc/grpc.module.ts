import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module.js";
import { AnalyticsGrpcController } from "./analytics-grpc.controller.js";
@Module({ imports: [AnalyticsModule], controllers: [AnalyticsGrpcController] })
export class GrpcModule {}
