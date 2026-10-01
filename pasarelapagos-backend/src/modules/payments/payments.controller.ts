// src/modules/payments/payments.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from '@/modules/payments/payments.service.js';
import { CreatePaymentDto } from '@/modules/payments/dto/create-payment.dto.js';
import { ListPaymentsDto } from '@/modules/payments/dto/list-payments.dto.js';
import { AuthGuard } from '@/common/guards/auth.guard.js';
import { TenantGuard } from '@/common/guards/tenant.guard.js';
import { WriteGuard } from '@/common/guards/write.guard.js';
import { PciGuard } from '@/common/guards/pci.guard.js';
import { OrgCtx } from '@/common/decorators/org.decorator.js';
import type { OrgContext } from '@/common/interfaces/org-context.interface.js';

@ApiTags('payments')
@ApiSecurity('x-api-key')
@ApiBearerAuth()
@UseGuards(AuthGuard, TenantGuard)
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @UseGuards(WriteGuard, PciGuard)
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiHeader({ name: 'x-organization-id', required: true })
  create(
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.payments.create(dto, idempotencyKey, ctx);
  }

  @Get()
  @ApiHeader({ name: 'x-organization-id', required: true })
  findAll(@Query() query: ListPaymentsDto, @OrgCtx() ctx: OrgContext) {
    return this.payments.findAll(ctx, query);
  }

  @Get(':id')
  @ApiHeader({ name: 'x-organization-id', required: true })
  findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.payments.findOne(id, ctx);
  }

  @Post(':id/refund')
  @UseGuards(WriteGuard)
  @ApiHeader({ name: 'x-organization-id', required: true })
  refund(
    @Param('id') id: string,
    @Body() body: { amountMinor?: number; reason?: string },
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.payments.refund(id, body, ctx);
  }
}
