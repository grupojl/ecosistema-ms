import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module.js";
import { WorkersGrpcController } from "./workers-grpc.controller.js";
@Module({ imports: [JobsModule], controllers: [WorkersGrpcController] }) export class GrpcModule {}
