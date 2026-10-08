// chatia-backend/src/agent-notifications/agent-notifications.controller.ts
// Alertas in-app para agentes del dashboard — transversal a todos los ecosistemas
// Consume core/notifications/ — no tiene lógica de dominio propia
import {
  Controller, Get, Patch, Param, Query, UseGuards, ForbiddenException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { TenantGuard }            from "@/infrastructure/common/guards/tenant.guard.js";
import { Tenant }                 from "@/infrastructure/common/decorators/tenant.decorator.js";
import type { TenantContext }     from "@/infrastructure/common/types/tenant-context.js";
import { NotificationsService }   from "@/core/notifications/notifications.service.js";
import { ZodValidationPipe }      from "@/infrastructure/common/pipes/zod-validation.pipe.js";
import { ListNotificationsSchema, type ListNotificationsInput } from "@/agent-notifications/schemas.js";

@ApiTags("agent-notifications")
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller("api/v1/notifications")
export class AgentNotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(ListNotificationsSchema)) q: ListNotificationsInput,
  ) {
    return this.svc.list(this.agentIdOf(tenant), q.read === false, q.page, q.limit);
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @Tenant() tenant: TenantContext) {
    return this.svc.markRead(id, this.agentIdOf(tenant));
  }

  /** Las notificaciones son por agente (no por organización). */
  private agentIdOf(tenant: TenantContext): string {
    if (!tenant.agentId) throw new ForbiddenException('El usuario no tiene un agente asociado');
    return tenant.agentId;
  }
}
