import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth }  from '@nestjs/swagger';
import { z }                       from 'zod';
import { AdAccountsService }       from './ad-accounts.service.js';
import { ZodValidationPipe }       from '../common/pipes/zod-validation.pipe.js';
import { TenantGuard, Tenant }     from '@ecosistema-ms/auth-server';
import type { TenantContext }      from '@ecosistema-ms/auth-server';

const ConnectSchema = z.object({
  platform:       z.enum(['META', 'GOOGLE', 'TIKTOK']),
  externalId:     z.string().min(1),
  name:           z.string().min(1),
  accessToken:    z.string().min(1),
  refreshToken:   z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

@ApiTags('ad-accounts')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('api/v1/ad-accounts')
export class AdAccountsController {
  constructor(private readonly service: AdAccountsService) {}

  @Get()
  findAll(@Tenant() t: TenantContext) { return this.service.findAll(t.ecosystemId, t.organizationId); }

  @Post()
  connect(@Tenant() t: TenantContext, @Body(new ZodValidationPipe(ConnectSchema)) dto: z.infer<typeof ConnectSchema>) {
    return this.service.connect({ ecosystemId: t.ecosystemId, organizationId: t.organizationId, ...dto });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  disconnect(@Param('id') id: string, @Tenant() t: TenantContext) {
    return this.service.disconnect(id, t.organizationId);
  }
}
