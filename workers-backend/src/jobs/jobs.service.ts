import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  constructor(private readonly prisma: PrismaService) {}
  async getJobStatus(jobId: string) {
    const log = await this.prisma.jobLog.findUnique({ where: { jobId } });
    if (!log) throw new NotFoundException(`Job ${jobId} no encontrado`);
    return log;
  }
  async createJobLog(data: { ecosystemId:string; organizationId:string; queue:string; jobId:string; input:unknown }) {
    return this.prisma.jobLog.create({ data: { ...data, input: data.input as any, status: "PENDING" } });
  }
  async updateJobLog(jobId: string, update: { status?:"PROCESSING"|"DONE"|"FAILED"|"CANCELLED"; result?:unknown; error?:string; attempts?:number; startedAt?:Date; completedAt?:Date; durationMs?:number }) {
    return this.prisma.jobLog.update({ where: { jobId }, data: { ...update, result: update.result as any } })
      .catch(err => this.logger.error(`No se pudo actualizar JobLog ${jobId}: ${err.message}`));
  }
}
