import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  constructor() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout: 2000,
      retryStrategy: () => 2000,
    });
    this.client.on('error', (err) =>
      new Logger(RedisService.name).debug(err.message),
    );
  }
  async publishEvent(event: unknown) {
    await this.client.publish('EXCHANGE_EVENTS', JSON.stringify(event));
  }
  onModuleDestroy() {
    this.client.disconnect();
  }
}
