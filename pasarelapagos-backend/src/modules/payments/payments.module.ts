// pasarelapagos-backend/src/modules/payments/payments.module.ts
// FASE 4: Repository conectado — PaymentsService inyecta IPaymentsRepository
import { Module }           from '@nestjs/common';
import { BullModule }       from '@nestjs/bullmq';
import { PaymentsController }         from './payments.controller';
import { PaymentsService }            from './payments.service';
import { ReconciliationService }      from './reconciliation.service';
import { ReconcileProcessor }         from './reconcile.processor';
import { PrismaPaymentsRepository }   from './repository/prisma-payments.repository';
import { PAYMENTS_REPOSITORY }        from './repository/payments.repository.interface';
import { QUEUE_RECONCILE }            from '../../common/constants/queues';

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
