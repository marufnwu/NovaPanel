import Redis from 'ioredis';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

/**
 * Singleton Redis client for NovaPanel.
 * Used for session cache, rate limit counters, password reset tokens, and job queue events.
 */
class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;

  getClient(): Redis {
    if (!this.client) {
      const url = env.REDIS_URL || 'redis://127.0.0.1:6379';
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        enableReadyCheck: true,
        connectTimeout: 5000,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected');
      });

      this.client.on('error', (err) => {
        logger.error({ err }, 'Redis error');
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });
    }
    return this.client;
  }

  async connect(): Promise<void> {
    const client = this.getClient();
    if (!this.isConnected) {
      await client.connect();
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

export const redisClient = new RedisClient();