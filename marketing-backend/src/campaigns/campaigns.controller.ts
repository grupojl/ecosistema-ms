import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z }                      from 'zod';
import { CampaignsService }       from './campaigns.service.js';
import { ZodValidationPipe }      from '../common/pipes/zod-validation.pipe.js';
import { TenantGuard, Tenant }    from '@ecosistema-ms/auth-server';
import type { TenantContext }     from '@ecosistema-ms/auth-server';

const CreateRuleSchema = z.object({
  name:      z.string().min(3),
  condition: z.object({
    metric: z.enum(['roas','ctr','cpc','spend','conversions']),
    operator: z.enum(['lt','gt','lte','gte']),
    value: z.number().positive(),
    windowDays: z.number().int().min(1).max(30),
  }),
  action: z.object({ type: z.enum(['pause','scale_budget','notify']), factor: z.number().min(0.1).max(5.0).optional() }),
});

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('api/v1/campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()       findAll(@Tenant() t: TenantContext) { return this.service.findAll(t.ecosystemId, t.organizationId); }
  @Get(':id')  findOne(@Param('id') id: string, @Tenant() t: TenantContext) { return this.service.findOne(id, t.organizationId); }
  @Get(':id/metrics')         getMetrics(@Param('id') id: string, @Tenant() t: TenantContext) { return this.service.getMetrics(id, t.organizationId); }
  @Get(':id/metrics/summary') getSummary(@Param('id') id: string, @Tenant() t: TenantContext) { return this.service.getMetricsSummary(id, t.organizationId); }
  @Get(':id/automation-rules') getRules(@Param('id') id: string, @Tenant() t: TenantContext) { return this.service.getAutomationRules(id, t.organizationId); }

  @Post(':id/automation-rules')
  createRule(@Param('id') cid: string, @Tenant() t: TenantContext, @Body(new ZodValidationPipe(CreateRuleSchema)) dto: z.infer<typeof CreateRuleSchema>) {
    return this.service.createAutomationRule(cid, t.organizationId, dto);
  }

  @Patch('automation-rules/:ruleId')
  toggleRule(@Param('ruleId') rid: string, @Tenant() t: TenantContext, @Body(new ZodValidationPipe(z.object({ isActive: z.boolean() }))) dto: { isActive: boolean }) {
    return this.service.toggleAutomationRule(rid, t.organizationId, dto.isActive);
  }
}
