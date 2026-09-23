import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ExchangeService } from '../exchange/exchange.service';

@Injectable()
export class TradeService {
  constructor(
    private readonly manager: EntityManager,
    private readonly exchange: ExchangeService,
  ) {}
  async getQuote(assetId: string) {
    const [row] = await this.manager.query(
      `SELECT COALESCE(t.price,a.initial_price,0)::text AS price
      FROM assets a LEFT JOIN LATERAL (SELECT price FROM trades WHERE asset_id=a.id ORDER BY sequence DESC LIMIT 1) t ON true
      WHERE a.id=$1 AND a.status='approved'`,
      [assetId],
    );
    if (!row) throw new NotFoundException('Asset not found');
    return row;
  }
  async getHistory(assetId: string, timeframe?: string, days = 3) {
    if (!Number.isInteger(days) || days < 1 || days > 3650)
      throw new BadRequestException('Days must be between 1 and 3650');
    if (!timeframe)
      return this.manager.query(
        `SELECT * FROM (SELECT id,price,timestamp,sequence FROM trades WHERE asset_id=$1
      AND timestamp>=now()-make_interval(days=>$2) ORDER BY sequence DESC LIMIT 1000) recent ORDER BY sequence`,
        [assetId, days],
      );
    const match = /^([1-9]\d{0,3})([mhd])$/.exec(timeframe);
    if (!match)
      throw new BadRequestException(
        'Timeframe must be a positive number of minutes, hours or days',
      );
    const interval = Number(match[1]) * { m: 60, h: 3600, d: 86400 }[match[2]]!;
    if (Math.ceil((days * 86400) / interval) > 10000)
      throw new BadRequestException('Choose a larger candle interval');
    return this.manager.query(
      `SELECT date_bin(make_interval(secs=>$2),timestamp,timestamp '2000-01-01') AS timestamp,
      (array_agg(price ORDER BY sequence))[1]::text AS open,max(price)::text AS high,min(price)::text AS low,
      (array_agg(price ORDER BY sequence DESC))[1]::text AS close,sum(quantity)::text AS volume
      FROM trades WHERE asset_id=$1 AND timestamp>=now()-make_interval(days=>$3) GROUP BY 1 ORDER BY 1`,
      [assetId, interval, days],
    );
  }
  async markets() {
    return this.manager
      .query(`SELECT a.*,COALESCE(t.price,a.initial_price,0)::text AS price,
      (COALESCE(t.price,a.initial_price,0)-COALESCE(previous.price,a.initial_price,t.price,0))::text AS change,
      COALESCE(100*(COALESCE(t.price,a.initial_price,0)-COALESCE(previous.price,a.initial_price,t.price,0)) /
        NULLIF(COALESCE(previous.price,a.initial_price,t.price,0),0),0)::text AS "changePercent",
      COALESCE(volume.value,0)::text AS volume
      FROM assets a
      LEFT JOIN LATERAL (SELECT price FROM trades WHERE asset_id=a.id ORDER BY sequence DESC LIMIT 1) t ON true
      LEFT JOIN LATERAL (SELECT price FROM trades WHERE asset_id=a.id AND timestamp<=now()-interval '24 hours' ORDER BY sequence DESC LIMIT 1) previous ON true
      LEFT JOIN LATERAL (SELECT sum(price*quantity) AS value FROM trades WHERE asset_id=a.id AND timestamp>now()-interval '24 hours') volume ON true
      WHERE a.status='approved' ORDER BY a.name`);
  }
  async getMarketStats() {
    const rows = await this.markets();
    const assets = rows.map((a) => ({
      assetId: a.id,
      currentPrice: Number(a.price),
      change: Number(a.change),
      percentChange: Number(a.changePercent),
      volume: Number(a.volume),
    }));
    return {
      volume24h: assets.reduce((s, a) => s + a.volume, 0),
      topAssetsByVolume: [...assets]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5),
      topGainers: assets
        .filter((a) => a.change > 0)
        .sort((a, b) => b.percentChange - a.percentChange)
        .slice(0, 5),
      topLosers: assets
        .filter((a) => a.change < 0)
        .sort((a, b) => a.percentChange - b.percentChange)
        .slice(0, 5),
    };
  }
  async getPrices(ids: string[]) {
    if (!ids.length) return [];
    return this.manager.query(
      `SELECT a.id AS "assetId",COALESCE(t.price,a.initial_price,0)::text AS price FROM assets a
      LEFT JOIN LATERAL (SELECT price FROM trades WHERE asset_id=a.id ORDER BY sequence DESC LIMIT 1) t ON true
      WHERE a.id=ANY($1::uuid[])`,
      [ids],
    );
  }
  async getOrderBookSnapshot(id: string) {
    return (await this.exchange.snapshot(id)).book;
  }
  getAllTrades() {
    return this.manager.query(
      'SELECT * FROM trades ORDER BY sequence DESC LIMIT 100',
    );
  }
}
