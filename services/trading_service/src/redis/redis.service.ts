import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(url);
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async publishTrade(assetId: string, price: number, quantity: number) {
    const payload = JSON.stringify({ assetId, price, quantity, timestamp: Date.now() });
    await this.client.publish('TRADE_EVENTS', payload);
  }

  async publishOrderBookUpdate(assetId: string) {
    const payload = JSON.stringify({ assetId, timestamp: Date.now() });
    await this.client.publish('ORDER_BOOK_EVENTS', payload);
  }
}
