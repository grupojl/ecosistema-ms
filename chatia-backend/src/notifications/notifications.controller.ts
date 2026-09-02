// src/notifications/notifications.controller.ts
import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ListNotificationsSchema, type ListNotificationsInput } from './schemas';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(TenantGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones del agente autenticado' })
  list(
    @Tenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(ListNotificationsSchema)) query: ListNotificationsInput,
  ) {
    if (!tenant.agentId) return { success: true, data: [] };
    return this.svc.list(tenant.agentId, query.read, query.page);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas como leídas' })
  markAllRead(@Tenant() tenant: TenantContext) {
    if (!tenant.agentId) return { success: true };
    return this.svc.markAllRead(tenant.agentId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  markRead(@Param('id') id: string, @Tenant() tenant: TenantContext) {
    if (!tenant.agentId) return { success: true };
    return this.svc.markRead(id, tenant.agentId);
  }
}
