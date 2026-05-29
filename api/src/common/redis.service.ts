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

  // ── Active Zone & Heartbeat helpers ────────────────────────────────────────
  /** Get number of active users in checkout area (still alive) */
  async getActiveCount(eventId: string): Promise<number> {
    const now = Date.now();
    return this.client.zcount(`active_users:${eventId}`, now, '+inf');
  }

  /** Add user to active checkout zone with expiry timestamp */
  async addToActiveZone(eventId: string, userId: string, ttlSeconds: number): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000;
    await this.client.zadd(`active_users:${eventId}`, expiry, userId);
  }

  /** Remove user from active zone */
  async removeFromActiveZone(eventId: string, userId: string): Promise<void> {
    await this.client.zrem(`active_users:${eventId}`, userId);
  }

  /** Check if a user is currently active for an event (not expired) */
  async isUserActiveInEvent(eventId: string, userId: string): Promise<boolean> {
    const scoreStr = await this.client.zscore(`active_users:${eventId}`, userId);
    if (!scoreStr) return false;
    return parseFloat(scoreStr) >= Date.now();
  }

  /** Get active users who have expired heartbeats */
  async getExpiredActiveUsers(eventId: string): Promise<string[]> {
    const now = Date.now();
    return this.client.zrangebyscore(`active_users:${eventId}`, '-inf', now);
  }

  /** Remove active users with expired heartbeats */
  async removeExpiredActiveUsers(eventId: string): Promise<void> {
    const now = Date.now();
    await this.client.zremrangebyscore(`active_users:${eventId}`, '-inf', now);
  }

  /** Renew queue heartbeat for a user waiting in queue */
  async queueHeartbeatRenew(eventId: string, userId: string, ttlSeconds: number): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000;
    await this.client.zadd(`queue_heartbeats:${eventId}`, expiry, userId);
  }

  /** Check if a queue user's heartbeat is still alive */
  async isQueueUserAlive(eventId: string, userId: string): Promise<boolean> {
    const scoreStr = await this.client.zscore(`queue_heartbeats:${eventId}`, userId);
    if (!scoreStr) return false;
    return parseFloat(scoreStr) >= Date.now();
  }

  /** Get users in queue whose heartbeats have expired */
  async getExpiredQueueUsers(eventId: string): Promise<string[]> {
    const now = Date.now();
    return this.client.zrangebyscore(`queue_heartbeats:${eventId}`, '-inf', now);
  }

  /** Remove expired users from queue heartbeats */
  async removeExpiredQueueUsers(eventId: string): Promise<void> {
    const now = Date.now();
    await this.client.zremrangebyscore(`queue_heartbeats:${eventId}`, '-inf', now);
  }

  /** Store the eventId that the user is currently queueing/active for */
  async setUserEvent(userId: string, eventId: string, ttlSeconds = 3600): Promise<void> {
    await this.client.set(`user_event:${userId}`, eventId, 'EX', ttlSeconds);
  }

  /** Get the current eventId of the user */
  async getUserEvent(userId: string): Promise<string | null> {
    return this.client.get(`user_event:${userId}`);
  }

  // ── Legacy Heartbeat helpers (kept for compatibility) ─────────────────────
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
