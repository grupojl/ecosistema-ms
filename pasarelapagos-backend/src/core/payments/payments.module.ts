// pasarelapagos-backend/src/modules/payments/payments.module.ts
// FASE 4: Repository conectado — PaymentsService inyecta IPaymentsRepository
import { Module }           from '@nestjs/common';
import { BullModule }       from '@nestjs/bullmq';
import { PaymentsController }         from '@/modules/payments/payments.controller.js';
import { PaymentsService }            from '@/modules/payments/payments.service.js';
import { ReconciliationService }      from '@/modules/payments/reconciliation.service.js';
import { ReconcileProcessor }         from '@/modules/payments/reconcile.processor.js';
import { PrismaPaymentsRepository }   from '@/modules/payments/repository/prisma-payments.repository.js';
import { PAYMENTS_REPOSITORY }        from '@/modules/payments/repository/payments.repository.interface.js';
import { QUEUE_RECONCILE }            from '@/common/constants/queues.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_RECONCILE }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    ReconciliationService,
    ReconcileProcessor,
    PrismaPaymentsRepository,
    // Binding: el Service inyecta IPaymentsRepository via este token
    {
      provide:  PAYMENTS_REPOSITORY,
      useClass: PrismaPaymentsRepository,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
