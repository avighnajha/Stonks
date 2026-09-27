import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private readonly logger = new Logger(OutboxService.name);
  constructor(
    private readonly manager: EntityManager,
    private readonly redis: RedisService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.flush();
    }, 500);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async flush() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.manager.transaction(async (m) => {
        const [{ locked }] = await m.query(
          'SELECT pg_try_advisory_xact_lock(73190422) AS locked',
        );
        if (!locked) return;
        const events =
          await m.query(`SELECT sequence::text,asset_id AS "assetId",type,payload,created_at AS timestamp
          FROM exchange_events WHERE published_at IS NULL ORDER BY sequence LIMIT 100`);
        for (const event of events) {
          await this.redis.publishEvent(event);
          await m.query(
            'UPDATE exchange_events SET published_at=now() WHERE sequence=$1',
            [event.sequence],
          );
        }
      });
    } catch (error) {
      // Committed events remain replayable through REST and are retried. A crash can duplicate delivery.
      this.logger.debug(`Outbox delivery deferred: ${error.message}`);
    } finally {
      this.busy = false;
    }
  }
}
