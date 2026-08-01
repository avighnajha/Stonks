import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';

    // configure reconnect/backoff strategy and options to avoid noisy crashes
    this.client = new Redis(url, {
      // allow unlimited retries per request while service is recovering
      maxRetriesPerRequest: null,
      // Exponential backoff with cap (ms)
      retryStrategy: (times: number) => {
        const delay = Math.min(Math.round(1000 * Math.pow(1.5, times)), 30000);
        this.logger.warn(`Redis retry attempt #${times}, retrying in ${delay}ms`);
        return delay;
      },
      // reconnect on network errors
      reconnectOnError: (err: Error) => {
        this.logger.warn(`Redis reconnectOnError: ${err?.message}`);
        return true;
      }
    });

    this.client.on('connect', () => this.logger.log('Redis client connecting'));
    this.client.on('ready', () => this.logger.log('Redis client ready'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
    this.client.on('close', () => this.logger.warn('Redis connection closed'));
    this.client.on('end', () => this.logger.warn('Redis connection ended'));
  }

  async publishTrade(assetId: string, price: number, quantity: number) {
    const payload = JSON.stringify({ assetId, price, quantity, timestamp: Date.now() });
    try {
      if (!this.client) throw new Error('Redis client not initialized');
      await this.client.publish('TRADE_EVENTS', payload);
    } catch (e) {
      this.logger.warn(`Failed to publish TRADE_EVENTS to Redis: ${e?.message || e}`);
      // swallow errors to avoid crashing trading flow; publisher is best-effort
    }
  }

  async publishOrderBookUpdate(assetId: string) {
    const payload = JSON.stringify({ assetId, timestamp: Date.now() });
    try {
      if (!this.client) throw new Error('Redis client not initialized');
      await this.client.publish('ORDER_BOOK_EVENTS', payload);
    } catch (e) {
      this.logger.warn(`Failed to publish ORDER_BOOK_EVENTS to Redis: ${e?.message || e}`);
    }
  }
}
