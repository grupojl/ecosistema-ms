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
import { PaymentsService } from '@/core/payments/payments.service.js';
import { ZodValidationPipe } from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import {
  CreatePaymentSchema, ListPaymentsSchema, RefundSchema,
  type CreatePaymentInput, type ListPaymentsInput, type RefundInput,
} from '@/core/payments/schemas.js';
import { AuthGuard } from '@/infrastructure/common/guards/auth.guard.js';
import { TenantGuard } from '@/infrastructure/common/guards/tenant.guard.js';
import { WriteGuard } from '@/infrastructure/common/guards/write.guard.js';
import { PciGuard } from '@/infrastructure/common/guards/pci.guard.js';
import { OrgCtx } from '@/infrastructure/common/decorators/org.decorator.js';
import type { OrgContext } from '@/infrastructure/common/interfaces/org-context.interface.js';

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
    @Body(new ZodValidationPipe(CreatePaymentSchema)) dto: CreatePaymentInput,
    @Headers('idempotency-key') idempotencyKey: string,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.payments.create(dto, idempotencyKey, ctx);
  }

  @Get()
  @ApiHeader({ name: 'x-organization-id', required: true })
  findAll(@Query(new ZodValidationPipe(ListPaymentsSchema)) query: ListPaymentsInput, @OrgCtx() ctx: OrgContext) {
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
    @Body(new ZodValidationPipe(RefundSchema)) body: RefundInput,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.payments.refund(id, body, ctx);
  }
}
