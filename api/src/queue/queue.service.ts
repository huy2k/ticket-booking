import { Injectable, BadRequestException } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { QueueGateway } from '../gateway/queue.gateway';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface QueueStatus {
  position: number; // 1-based position
  total: number; // total in queue
  estimatedWaitMinutes: number;
  entered: boolean;
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
      // TTL 1 hour for bookingId
      await this.redis.set(`booking:${eventId}:${userId}`, bookingId, 3600);
    }

    // Set mapping user to event
    await this.redis.setUserEvent(userId, eventId, 3600);

    // Check if user is ALREADY active (e.g. page refresh)
    const isUserActive = await this.redis.isUserActiveInEvent(eventId, userId);
    if (isUserActive) {
      const ttl = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '30', 10);
      await this.redis.addToActiveZone(eventId, userId, ttl);
      return { entered: true, bookingId };
    }

    const activeCount = await this.redis.getActiveCount(eventId);

    if (activeCount < this.MAX_ACTIVE) {
      // Enter directly
      const ttl = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '30', 10);
      await this.redis.addToActiveZone(eventId, userId, ttl);
      return { entered: true, bookingId };
    }

    // Add to queue (ZADD is idempotent if already in queue with same score)
    const existing = await this.redis.queueRank(eventId, userId);
    if (existing === null) {
      await this.redis.queueJoin(eventId, userId);
    }
    // Set queue heartbeat alive
    const ttl = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '30', 10);
    await this.redis.queueHeartbeatRenew(eventId, userId, ttl);

    const status = await this.getStatus(eventId, userId);
    return { entered: false, status, bookingId };
  }

  /** Get current queue status for a user */
  async getStatus(eventId: string, userId: string): Promise<QueueStatus> {
    const isUserActive = await this.redis.isUserActiveInEvent(eventId, userId);
    if (isUserActive) {
      return { position: 0, total: 0, estimatedWaitMinutes: 0, entered: true };
    }

    const rank = await this.redis.queueRank(eventId, userId);
    const total = await this.redis.queueLength(eventId);
    const position = rank !== null ? rank + 1 : 0;

    // Estimate: assume each person takes average 5 minutes
    const estimatedWaitMinutes = position * 5;

    return { position, total, estimatedWaitMinutes, entered: false };
  }

  /**
   * Called when a user leaves checkout (completed or timeout or active heartbeat expired)
   * Pops next online person from queue and lets them in
   */
  async onUserLeft(eventId: string, userId?: string): Promise<void> {
    if (userId) {
      await this.redis.removeFromActiveZone(eventId, userId);
    }

    const activeCount = await this.redis.getActiveCount(eventId);
    let slotsAvailable = this.MAX_ACTIVE - activeCount;
    const ttl = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '30', 10);

    while (slotsAvailable > 0) {
      // Pop the front user from queue
      const popped = await this.redis.queuePopFront(eventId, 1);
      if (!popped || popped.length === 0) {
        break; // Queue is empty
      }

      // In ioredis, zpopmin returns a flat array of [member, score]
      const nextUserId = popped[0];

      // Check if this popped user is still online (has active heartbeat)
      const isAlive = await this.redis.isQueueUserAlive(eventId, nextUserId);
      if (isAlive) {
        // Add them to active zone
        await this.redis.addToActiveZone(eventId, nextUserId, ttl);
        // Clean up from queue heartbeats
        await this.redis.removeFromActiveZone(eventId, nextUserId); // ensure clean
        await this.redis.getClient().zrem(`queue_heartbeats:${eventId}`, nextUserId);

        // Notify via WebSocket
        this.gateway.notifyUserEnter(nextUserId);
        slotsAvailable--;
      } else {
        // Discard offline user, clean up they are already popped from queue.
        await this.redis.getClient().zrem(`queue_heartbeats:${eventId}`, nextUserId);
        // Loop again to fill this slot
      }
    }

    // Broadcast updated positions to all waiting users
    await this.broadcastQueueUpdate(eventId);
  }

  /**
   * Called when heartbeat expires (user disconnected)
   */
  async onHeartbeatExpired(eventId: string, userId: string): Promise<void> {
    await this.redis.queueRemove(eventId, userId);
    await this.redis.getClient().zrem(`queue_heartbeats:${eventId}`, userId);
    await this.onUserLeft(eventId, userId);
  }

  /** Renew heartbeat for a user */
  async renewHeartbeat(userId: string): Promise<void> {
    const ttl = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '30', 10);
    const eventId = await this.redis.getUserEvent(userId);
    if (eventId) {
      // Extend user_event mapping TTL to 1 hour
      await this.redis.setUserEvent(userId, eventId, 3600);

      // Check if user is active in checkout zone
      const isActive = await this.redis.isUserActiveInEvent(eventId, userId);
      if (isActive) {
        await this.redis.addToActiveZone(eventId, userId, ttl);
      } else {
        // Renew waiting queue heartbeat
        await this.redis.queueHeartbeatRenew(eventId, userId, ttl);
      }
    }
  }

  async broadcastQueueUpdate(eventId: string): Promise<void> {
    const total = await this.redis.queueLength(eventId);
    this.gateway.broadcastQueueUpdate(eventId, total);
  }
}
