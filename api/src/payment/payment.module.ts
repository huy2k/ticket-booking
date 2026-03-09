import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { CommonModule } from '../common/common.module';
import { SeatModule } from '../seat/seat.module';

@Module({
  imports: [CommonModule, SeatModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
