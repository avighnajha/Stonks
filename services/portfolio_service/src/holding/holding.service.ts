import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class HoldingService {
  constructor(private readonly manager: EntityManager) {}
  async getPortfolio(userId: string) {
    if (!userId) throw new UnauthorizedException();
    return this.manager.query(
      `SELECT h.asset_id AS "assetId",a.name,
      (h.quantity+h.frozen_quantity)::text AS quantity,h.quantity::text AS "availableQuantity",
      h.frozen_quantity::text AS "reservedQuantity",h.average_buy_price::text AS "averageBuyPrice",
      COALESCE(t.price,a.initial_price,0)::text AS "currentPrice",
      ((h.quantity+h.frozen_quantity)*COALESCE(t.price,a.initial_price,0))::text AS "currentValue",
      ((h.quantity+h.frozen_quantity)*(COALESCE(t.price,a.initial_price,0)-h.average_buy_price))::text AS "profitLoss",
      h.realized_pnl::text AS "realizedPnl"
      FROM holding h JOIN assets a ON a.id=h.asset_id
      LEFT JOIN LATERAL (SELECT price FROM trades WHERE asset_id=h.asset_id ORDER BY sequence DESC LIMIT 1) t ON true
      WHERE h.user_id=$1 ORDER BY a.name`,
      [userId],
    );
  }
  getAllHoldings() {
    return this.manager.query('SELECT * FROM holding');
  }
}
