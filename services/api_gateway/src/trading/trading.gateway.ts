import { OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ namespace: '/market', cors: { origin: true } })
export class TradingGateway
  implements
    OnModuleInit,
    OnModuleDestroy,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private redis: Redis;
  private readonly logger = new Logger(TradingGateway.name);
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private readonly jwt: JwtService) {}
  onModuleInit() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.redis.on('error', (e) => this.logger.debug(e.message));
    void this.redis
      .subscribe('EXCHANGE_EVENTS')
      .catch((e) => this.logger.warn(e.message));
    this.redis.on('message', (_channel, message) => {
      try {
        const event = JSON.parse(message);
        this.server.emit('exchange_event', event);
      } catch (e) {
        this.logger.warn('Invalid exchange event');
      }
    });
  }
  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      if (!payload.sub || !payload.exp) throw new Error('Invalid token claims');
      client.data.userId = payload.sub;
      const timer = setTimeout(
        () => client.disconnect(true),
        Math.max(0, payload.exp * 1000 - Date.now()),
      );
      timer.unref();
      this.timers.set(client.id, timer);
    } catch {
      client.disconnect(true);
    }
  }
  handleDisconnect(client: Socket) {
    const t = this.timers.get(client.id);
    if (t) clearTimeout(t);
    this.timers.delete(client.id);
  }
  onModuleDestroy() {
    this.redis?.disconnect();
    for (const t of this.timers.values()) clearTimeout(t);
  }
}
