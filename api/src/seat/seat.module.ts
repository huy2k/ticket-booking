import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SeatController } from './seat.controller';
import { SeatService } from './seat.service';
import { SeatScheduler } from './seat.scheduler';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SeatController],
  providers: [SeatService, SeatScheduler],
  exports: [SeatService],
})
export class SeatModule {}
