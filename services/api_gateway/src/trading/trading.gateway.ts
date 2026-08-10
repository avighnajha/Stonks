import { OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ namespace: 'market', cors: { origin: '*' } })
export class TradingGateway implements OnModuleInit, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private redis: Redis;
  private readonly logger = new Logger(TradingGateway.name);

  constructor(private readonly jwtService: JwtService) {}

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

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token ||
      client.handshake.headers.authorization?.toString().split(' ')[1];

    if (!token) {
      this.logger.warn('WebSocket connection rejected: missing token');
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'default-secret',
      }) as { role?: string };

      if (payload.role !== 'admin') {
        this.logger.warn('WebSocket connection rejected: non-admin role');
        client.disconnect();
      }
    } catch (err) {
      this.logger.warn('WebSocket connection rejected: invalid token');
      client.disconnect();
    }
  }
}
