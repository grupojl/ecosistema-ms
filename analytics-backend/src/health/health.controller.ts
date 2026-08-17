import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from "@nestjs/terminus";
import { PrismaService } from "../prisma/prisma.service.js";
import { Public } from "@ecosistema-ms/auth-server";
@Controller("api/v1/health") export class HealthController {
  constructor(private h: HealthCheckService, private pi: PrismaHealthIndicator, private db: PrismaService) {}
  @Get() @Public() @HealthCheck()
  check() { return this.h.check([() => this.pi.pingCheck("analytics_db", this.db)]); }
}
