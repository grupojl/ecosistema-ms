// pasarelapagos-backend/src/internal/internal.controller.ts
//
// Endpoints REST consumidos por grupojl-control (superadmin).
// Contrato: .claude/contracts/superadmin-api.md
//
// GET  /internal/payments           → listado filtrable con paginación
// GET  /internal/payments/:id       → detalle de un pago
// POST /internal/payments/:id/retry → reintento manual (reason obligatorio)
//
// El AdminAction lo crea superadmin en su propia DB — no este controller.
// Sin lógica de negocio: delega todo en InternalService.
import {
  Controller, Get, Post, Param, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { InternalApiKeyGuard }              from '@/internal/internal-api-key.guard.js';
import { InternalService }                  from '@/internal/internal.service.js';
import { ZodValidationPipe }                from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import {
  ListPaymentsSchema, RetryPaymentSchema,
  type ListPaymentsDto, type RetryPaymentDto,
} from '@/internal/schemas.js';

@ApiTags('internal')
@ApiHeader({ name: 'x-internal-api-key', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly svc: InternalService) {}

  @Get('payments')
  @ApiOperation({ summary: 'Lista pagos para superadmin — filtrable y paginado' })
  listPayments(@Query(new ZodValidationPipe(ListPaymentsSchema)) dto: ListPaymentsDto) {
    return this.svc.listPayments(dto);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Detalle de un pago para superadmin' })
  getPayment(@Param('id') id: string) {
    return this.svc.getPayment(id);
  }

  @Post('payments/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reintento manual de un pago fallido — reason >= 10 chars' })
  retryPayment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RetryPaymentSchema)) dto: RetryPaymentDto,
  ) {
    return this.svc.retryPayment(id, dto);
  }
}
