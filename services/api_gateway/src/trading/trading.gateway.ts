import { OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class TradingGateway implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  private redis: Redis;
  private readonly logger = new Logger(TradingGateway.name);

  onModuleInit() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(url);

    this.redis.on('error', (err) => this.logger.error('Redis subscriber error', err));

    this.redis.subscribe('TRADE_EVENTS', 'ORDER_BOOK_EVENTS').then(() => {
      this.logger.log('Subscribed to TRADE_EVENTS and ORDER_BOOK_EVENTS');
    }).catch((e) => this.logger.error('Failed to subscribe to Redis channels', e));

    this.redis.on('message', (channel: string, message: string) => {
      try {
        const payload = JSON.parse(message);
        if (channel === 'TRADE_EVENTS') {
          this.server.emit('newTrade', payload);
        } else if (channel === 'ORDER_BOOK_EVENTS') {
          this.server.emit('order_book_update', payload);
        }
      } catch (e) {
        this.logger.warn(`Failed to parse message on channel ${channel}: ${e}`);
      }
    });
  }
}
