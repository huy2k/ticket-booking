import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD') || undefined,
      lazyConnect: false,
    });

    this.client.on('connect', () => console.log('✅ Redis connected'));
    this.client.on('error', (err) => console.error('❌ Redis error:', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  // ── Sorted Set helpers ─────────────────────────────────────────────────────
  /** Add user to event queue with timestamp as score (FIFO) */
  async queueJoin(eventId: string, userId: string): Promise<void> {
    const score = Date.now();
    await this.client.zadd(`queue:${eventId}`, score, userId);
  }

  /** Get user's 0-based rank in queue (0 = front) */
  async queueRank(eventId: string, userId: string): Promise<number | null> {
    const rank = await this.client.zrank(`queue:${eventId}`, userId);
    return rank;
  }

  /** Get total queue length */
  async queueLength(eventId: string): Promise<number> {
    return this.client.zcard(`queue:${eventId}`);
  }

  /** Pop the front N users from queue */
  async queuePopFront(eventId: string, count = 1): Promise<string[]> {
    return this.client.zpopmin(`queue:${eventId}`, count);
  }

  /** Remove specific user from queue */
  async queueRemove(eventId: string, userId: string): Promise<void> {
    await this.client.zrem(`queue:${eventId}`, userId);
  }

  // ── Counter helpers ────────────────────────────────────────────────────────
  /** Get number of active users in checkout area */
  async getActiveCount(eventId: string): Promise<number> {
    const val = await this.client.get(`active_count:${eventId}`);
    return val ? parseInt(val, 10) : 0;
  }

  async incrementActive(eventId: string): Promise<number> {
    return this.client.incr(`active_count:${eventId}`);
  }

  async decrementActive(eventId: string): Promise<number> {
    return this.client.decr(`active_count:${eventId}`);
  }

  // ── Heartbeat helpers ──────────────────────────────────────────────────────
  /** Renew user heartbeat (TTL 30s by default) */
  async heartbeatRenew(userId: string, ttlSeconds = 30): Promise<void> {
    await this.client.set(`heartbeat:${userId}`, '1', 'EX', ttlSeconds);
  }

  /** Check if heartbeat still alive */
  async heartbeatAlive(userId: string): Promise<boolean> {
    const val = await this.client.get(`heartbeat:${userId}`);
    return val !== null;
  }

  /** Store queue token for user */
  async setQueueToken(userId: string, token: string, ttlSeconds = 3600): Promise<void> {
    await this.client.set(`queue_token:${userId}`, token, 'EX', ttlSeconds);
  }

  async getQueueToken(userId: string): Promise<string | null> {
    return this.client.get(`queue_token:${userId}`);
  }

  async deleteQueueToken(userId: string): Promise<void> {
    await this.client.del(`queue_token:${userId}`);
  }

  // ── Generic key-value helpers (for VNPay order mapping) ────────────────────
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async remove(key: string): Promise<void> {
    await this.client.del(key);
  }
}
