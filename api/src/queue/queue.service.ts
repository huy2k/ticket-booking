import { Injectable, BadRequestException } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { QueueGateway } from '../gateway/queue.gateway';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface QueueStatus {
  position: number; // 1-based position
  total: number; // total in queue
  estimatedWaitMinutes: number;
}

@Injectable()
export class QueueService {
  private readonly MAX_ACTIVE: number;

  constructor(
    private readonly redis: RedisService,
    private readonly gateway: QueueGateway,
    private readonly prisma: PrismaService,
  ) {
    this.MAX_ACTIVE = parseInt(process.env.QUEUE_MAX_ACTIVE || '100', 10);
  }

  /**
   * User clicks "Mua vé" → either enter directly or join queue
   */
  async joinOrEnter(
    eventId: string,
    userId: string,
  ): Promise<{ entered: boolean; status?: QueueStatus; bookingId?: string }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { saleStartAt: true },
    });

    if (!event) {
      throw new BadRequestException('Sự kiện không tồn tại');
    }

    if (event.saleStartAt && new Date() < event.saleStartAt) {
      throw new BadRequestException('Sự kiện chưa mở bán');
    }

    let bookingId = await this.redis.get(`booking:${eventId}:${userId}`);
    if (!bookingId) {
      bookingId = crypto.randomUUID();
      // TTL 1 giờ cho bookingId để bao hết thời gian trong hàng đợi + mua vé
      await this.redis.set(`booking:${eventId}:${userId}`, bookingId, 3600);
    }

    const activeCount = await this.redis.getActiveCount(eventId);

    if (activeCount < this.MAX_ACTIVE) {
      // Enter directly
      await this.redis.incrementActive(eventId);
      await this.redis.heartbeatRenew(userId, 30);
      return { entered: true, bookingId };
    }

    // Add to queue (ZADD is idempotent if already in queue with same score)
    const existing = await this.redis.queueRank(eventId, userId);
    if (existing === null) {
      await this.redis.queueJoin(eventId, userId);
    }

    const status = await this.getStatus(eventId, userId);
    return { entered: false, status, bookingId };
  }

  /** Get current queue status for a user */
  async getStatus(eventId: string, userId: string): Promise<QueueStatus> {
    const rank = await this.redis.queueRank(eventId, userId);
    const total = await this.redis.queueLength(eventId);
    const position = rank !== null ? rank + 1 : 0;

    // Estimate: assume each person takes average 5 minutes
    const estimatedWaitMinutes = position * 5;

    return { position, total, estimatedWaitMinutes };
  }

  /**
   * Called when a user leaves checkout (completed or timeout)
   * Pops next person from queue and lets them in
   */
  async onUserLeft(eventId: string): Promise<void> {
    await this.redis.decrementActive(eventId);

    // Pop front of queue
    const popped = await this.redis.queuePopFront(eventId, 2); // [member, score]
    if (popped.length >= 1) {
      const nextUserId = popped[0];
      await this.redis.incrementActive(eventId);
      await this.redis.heartbeatRenew(nextUserId, 30);

      // Notify via WebSocket
      this.gateway.notifyUserEnter(nextUserId);
    }

    // Broadcast updated positions to all waiting users
    await this.broadcastQueueUpdate(eventId);
  }

  /**
   * Called when heartbeat expires (user disconnected)
   */
  async onHeartbeatExpired(eventId: string, userId: string): Promise<void> {
    await this.redis.queueRemove(eventId, userId);
    await this.redis.decrementActive(eventId);
    await this.broadcastQueueUpdate(eventId);
  }

  /** Renew heartbeat for a user */
  async renewHeartbeat(userId: string): Promise<void> {
    const ttl = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '30', 10);
    await this.redis.heartbeatRenew(userId, ttl);
  }

  private async broadcastQueueUpdate(eventId: string): Promise<void> {
    const total = await this.redis.queueLength(eventId);
    this.gateway.broadcastQueueUpdate(eventId, total);
  }
}
