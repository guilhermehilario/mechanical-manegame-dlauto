import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { SecurityModule } from '../auth/security.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';

/** Payments on work orders (Bloco A — docs/todo-mvp.md). */
@Module({
  imports: [SecurityModule, WorkOrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsRepository, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
