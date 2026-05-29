import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QueueService } from './queue.service';
import { RedisService } from '../common/redis.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QueueScheduler {
  private readonly logger = new Logger(QueueScheduler.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('*/5 * * * * *') // Run every 5 seconds
  async processQueueCleanup() {
    try {
      const events = await this.prisma.event.findMany({ select: { id: true } });

      for (const event of events) {
        const eventId = event.id;

        // 1. Scan active zone for expired heartbeats
        const expiredActiveUsers = await this.redis.getExpiredActiveUsers(eventId);
        if (expiredActiveUsers.length > 0) {
          this.logger.log(`Active expired: ${expiredActiveUsers.join(', ')} for event ${eventId}`);
          for (const userId of expiredActiveUsers) {
            await this.queueService.onUserLeft(eventId, userId);
          }
        }

        // 2. Scan queue heartbeats for expired users (disconnected waiting users)
        const expiredQueueUsers = await this.redis.getExpiredQueueUsers(eventId);
        if (expiredQueueUsers.length > 0) {
          this.logger.log(`Queue expired: ${expiredQueueUsers.join(', ')} for event ${eventId}`);
          for (const userId of expiredQueueUsers) {
            await this.redis.queueRemove(eventId, userId);
          }
          await this.redis.removeExpiredQueueUsers(eventId);
          await this.queueService.broadcastQueueUpdate(eventId);
        }
      }
    } catch (err) {
      this.logger.error('Error in QueueScheduler', err);
    }
  }
}
