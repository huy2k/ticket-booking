import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SeatService } from './seat.service';

@Injectable()
export class SeatScheduler {
  private readonly logger = new Logger(SeatScheduler.name);

  constructor(private readonly seatService: SeatService) {}

  // Run every minute to release expired PENDING seats
  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredSeats() {
    const released = await this.seatService.releaseExpiredSeats();
    if (released > 0) {
      this.logger.log(`⏱ Released ${released} expired seat locks`);
    }
  }
}
