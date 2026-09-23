import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { balanceUnits, decimal, units } from './decimal';

export const EXCHANGE_LOCK = 73190421;
type Side = 'BUY' | 'SELL';
export interface OrderInput {
  assetId: string;
  side: Side;
  type: 'LIMIT' | 'MARKET';
  price: string | number;
  quantity: string | number;
}

@Injectable()
export class ExchangeService {
  constructor(private readonly manager: EntityManager) {}

  private async command(
    userId: string,
    key: string,
    request: unknown,
    work: (m: EntityManager) => Promise<any>,
  ) {
    if (!key || !/^[A-Za-z0-9_.:-]{1,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    return this.manager.transaction(async (m) => {
      await m.query("SET LOCAL lock_timeout = '5s'");
      await m.query("SET LOCAL statement_timeout = '10s'");
      // Global sequencing prevents cross-asset spending races and empty-book crossed arrivals.
      await m.query('SELECT pg_advisory_xact_lock($1)', [EXCHANGE_LOCK]);
      const [old] = await m.query(
        'SELECT request,response FROM exchange_commands WHERE user_id=$1 AND key=$2',
        [userId, key],
      );
      if (old) {
        const [{ same }] = await m.query(
          'SELECT $1::jsonb = $2::jsonb AS same',
          [JSON.stringify(old.request), JSON.stringify(request)],
        );
        if (!same)
          throw new ConflictException(
            'Idempotency key already used for a different command',
          );
        return old.response;
      }
      // Normalize once so initial and replayed responses have identical JSON types.
      const result = JSON.parse(JSON.stringify(await work(m)));
      await m.query(
        'INSERT INTO exchange_commands(user_id,key,request,response) VALUES($1,$2,$3,$4)',
        [userId, key, JSON.stringify(request), JSON.stringify(result)],
      );
      return result;
    });
  }

  private async ledger(
    m: EntityManager,
    user: string,
    asset: string | null,
    order: string | null,
    trade: string | null,
    reason: string,
    available: string,
    reserved: string,
  ) {
    await m.query(
      `INSERT INTO exchange_ledger(user_id,asset_id,order_id,trade_id,reason,available_delta,reserved_delta)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [user, asset, order, trade, reason, available, reserved],
    );
  }

  private async event(
    m: EntityManager,
    asset: string,
    type: string,
    payload: unknown,
  ) {
    await m.query(
      'INSERT INTO exchange_events(asset_id,type,payload) VALUES($1,$2,$3)',
      [asset, type, JSON.stringify(payload)],
    );
  }

  private async book(m: EntityManager, assetId: string) {
    const levels = await m.query(
      `SELECT side,price::text, sum(remaining_quantity)::text AS quantity, count(*)::int AS orders
      FROM orders WHERE asset_id=$1 AND status IN ('OPEN','PARTIALLY_FILLED') AND type='LIMIT'
      GROUP BY side,price ORDER BY side,price`,
      [assetId],
    );
    return {
      buys: levels
        .filter((x) => x.side === 'BUY')
        .reverse()
        .slice(0, 50)
        .map(({ side, ...x }) => x),
      sells: levels
        .filter((x) => x.side === 'SELL')
        .slice(0, 50)
        .map(({ side, ...x }) => x),
    };
  }

  async snapshot(assetId: string) {
    return this.manager.transaction('REPEATABLE READ', async (m) => {
      const [{ cursor }] = await m.query(
        'SELECT COALESCE(max(sequence),0)::text AS cursor FROM exchange_events',
      );
      const book = await this.book(m, assetId);
      return { assetId, cursor, book };
    });
  }

  async events(after: string, limit = 500) {
    if (!/^\d{1,18}$/.test(after))
      throw new BadRequestException('Invalid event cursor');
    const events = await this.manager.query(
      `SELECT sequence::text,asset_id AS "assetId",type,payload,created_at AS timestamp
      FROM exchange_events WHERE sequence > $1 ORDER BY sequence LIMIT $2`,
      [after, limit],
    );
    return {
      events,
      nextCursor: events.at(-1)?.sequence ?? after,
      hasMore: events.length === limit,
    };
  }

  async feedSnapshot() {
    return this.manager.transaction('REPEATABLE READ', async (m) => {
      const [{ cursor }] = await m.query(
        'SELECT COALESCE(max(sequence),0)::text AS cursor FROM exchange_events',
      );
      const latest =
        await m.query(`SELECT DISTINCT ON (type,asset_id) sequence::text,asset_id AS "assetId",type,payload,created_at AS timestamp
        FROM exchange_events WHERE type IN ('book','trade') ORDER BY type,asset_id,sequence DESC`);
      const news =
        await m.query(`SELECT sequence::text,asset_id AS "assetId",type,payload,created_at AS timestamp
        FROM exchange_events WHERE type='news' ORDER BY sequence DESC LIMIT 50`);
      return {
        cursor,
        events: [...latest, ...news].sort((a, b) =>
          BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1,
        ),
      };
    });
  }

  async orders(user: string, before?: string) {
    if (before && !/^\d{1,18}$/.test(before))
      throw new BadRequestException('Invalid order cursor');
    return this.manager.query(
      `SELECT * FROM orders WHERE user_id=$1 AND ($2::bigint IS NULL OR sequence < $2)
      ORDER BY sequence DESC LIMIT 100`,
      [user, before ?? null],
    );
  }

  async account(user: string) {
    return this.manager.transaction('REPEATABLE READ', async (m) => {
      const [wallet] = await m.query(
        'SELECT balance::text,frozen_balance::text FROM wallets WHERE user_id=$1',
        [user],
      );
      if (!wallet) throw new NotFoundException('Account not found');
      const positions = await m.query(
        `SELECT h.asset_id AS "assetId",a.name,h.quantity::text AS "availableQuantity",
        h.frozen_quantity::text AS "reservedQuantity",(h.quantity+h.frozen_quantity)::text AS quantity,
        h.average_buy_price::text AS "averageBuyPrice",h.realized_pnl::text AS "realizedPnl",
        COALESCE(t.price,a.initial_price,0)::text AS "currentPrice",
        ((h.quantity+h.frozen_quantity)*COALESCE(t.price,a.initial_price,0))::text AS "currentValue",
        ((h.quantity+h.frozen_quantity)*(COALESCE(t.price,a.initial_price,0)-h.average_buy_price))::text AS "profitLoss"
        FROM holding h JOIN assets a ON a.id=h.asset_id
        LEFT JOIN LATERAL (SELECT price FROM trades WHERE asset_id=h.asset_id ORDER BY sequence DESC LIMIT 1) t ON true
        WHERE h.user_id=$1 ORDER BY a.name`,
        [user],
      );
      return { wallet, positions };
    });
  }

  async leaderboard() {
    return this.manager.query(`SELECT u.id AS "userId",u.username AS name,
      (w.balance+w.frozen_balance)::text AS cash,COALESCE(p.value,0)::text AS "portfolioValue",
      (w.balance+w.frozen_balance+COALESCE(p.value,0))::text AS "netWorth"
      FROM users u JOIN wallets w ON w.user_id=u.id
      LEFT JOIN LATERAL (SELECT sum((h.quantity+h.frozen_quantity)*COALESCE(t.price,a.initial_price,0)) AS value
        FROM holding h JOIN assets a ON a.id=h.asset_id
        LEFT JOIN LATERAL (SELECT price FROM trades WHERE asset_id=h.asset_id ORDER BY sequence DESC LIMIT 1) t ON true
        WHERE h.user_id=u.id) p ON true ORDER BY (w.balance+w.frozen_balance+COALESCE(p.value,0)) DESC LIMIT 100`);
  }

  async order(user: string, id: string) {
    const [order] = await this.manager.query(
      'SELECT * FROM orders WHERE id=$1 AND user_id=$2',
      [id, user],
    );
    if (!order) throw new NotFoundException('Order not found');
    const fills = await this.manager.query(
      `SELECT id,asset_id,price,quantity,timestamp
      FROM trades WHERE buy_order_id=$1 OR sell_order_id=$1 ORDER BY timestamp,id`,
      [id],
    );
    return { ...order, fills };
  }

  async fills(user: string, after = '0') {
    if (!/^\d{1,18}$/.test(after))
      throw new BadRequestException('Invalid fill cursor');
    return this.manager.query(
      `SELECT sequence::text,id,asset_id,price,quantity,timestamp,
      CASE WHEN buyer_id=$1 THEN 'BUY' ELSE 'SELL' END AS side,
      CASE WHEN buyer_id=$1 THEN buy_order_id ELSE sell_order_id END AS order_id
      FROM trades WHERE (buyer_id=$1 OR seller_id=$1) AND sequence>$2 ORDER BY sequence LIMIT 500`,
      [user, after],
    );
  }

  async place(user: string, key: string, input: OrderInput) {
    if (
      !['BUY', 'SELL'].includes(input.side) ||
      !['LIMIT', 'MARKET'].includes(input.type)
    )
      throw new BadRequestException('Invalid order side/type');
    const price = decimal(units(input.price, 2), 2);
    const quantity = decimal(units(input.quantity, 4), 4);
    const request = { action: 'place', ...input, price, quantity };
    return this.command(user, key, request, async (m) => {
      const [asset] = await m.query(
        "SELECT id FROM assets WHERE id=$1 AND status='approved'",
        [input.assetId],
      );
      if (!asset)
        throw new BadRequestException('Asset is not approved for trading');
      const [wallet] = await m.query(
        'SELECT id FROM wallets WHERE user_id=$1',
        [user],
      );
      if (!wallet) throw new BadRequestException('Account wallet not found');
      const order = await this.admit(m, user, { ...input, price, quantity });
      const book = await this.book(m, input.assetId);
      await this.event(m, input.assetId, 'book', { book });
      return {
        message: 'Order processed',
        orderId: order.id,
        status: order.status,
        filledQuantity: decimal(
          balanceUnits(quantity, 4) - balanceUnits(order.remaining_quantity, 4),
          4,
        ),
        remainingQuantity: order.remaining_quantity,
      };
    });
  }

  private async admit(m: EntityManager, user: string, input: OrderInput) {
    const p = units(input.price, 2),
      qty = units(input.quantity, 4);
    const price = decimal(p, 2),
      quantity = decimal(qty, 4),
      reserve = decimal(p * qty, 6);
    const id = randomUUID();
    if (input.side === 'BUY') {
      const rows = await m.query(
        `UPDATE wallets SET balance=balance-$2,frozen_balance=frozen_balance+$2,updated_at=now()
        WHERE user_id=$1 AND balance >= $2 RETURNING id`,
        [user, reserve],
      );
      if (!rows[0]?.length)
        throw new BadRequestException('Insufficient available cash');
      await this.ledger(
        m,
        user,
        null,
        id,
        null,
        'reserve',
        decimal(-p * qty, 6),
        reserve,
      );
    } else {
      const rows = await m.query(
        `UPDATE holding SET quantity=quantity-$3,frozen_quantity=frozen_quantity+$3
        WHERE user_id=$1 AND asset_id=$2 AND quantity >= $3 RETURNING id`,
        [user, input.assetId, quantity],
      );
      if (!rows[0]?.length)
        throw new BadRequestException('Insufficient available holdings');
      await this.ledger(
        m,
        user,
        input.assetId,
        id,
        null,
        'reserve',
        decimal(-qty, 4),
        quantity,
      );
    }
    const [order] = await m.query(
      `INSERT INTO orders(id,user_id,asset_id,side,type,status,price,initial_quantity,remaining_quantity,reserved_cash,reserved_quantity)
      VALUES($1,$2,$3,$4,$5,'OPEN',$6,$7,$7,$8,$9) RETURNING *`,
      [
        id,
        user,
        input.assetId,
        input.side,
        input.type,
        price,
        quantity,
        input.side === 'BUY' ? reserve : '0',
        input.side === 'SELL' ? quantity : '0',
      ],
    );
    const makers = await m.query(
      `SELECT * FROM orders WHERE asset_id=$1 AND side=$2 AND type='LIMIT'
      AND status IN ('OPEN','PARTIALLY_FILLED') AND user_id <> $3
      AND price ${input.side === 'BUY' ? '<=' : '>='} $4
      ORDER BY price ${input.side === 'BUY' ? 'ASC' : 'DESC'},sequence ASC FOR UPDATE`,
      [input.assetId, input.side === 'BUY' ? 'SELL' : 'BUY', user, price],
    );
    for (const maker of makers) {
      const remaining = balanceUnits(order.remaining_quantity, 4);
      if (remaining === 0n) break;
      const makerQty = balanceUnits(maker.remaining_quantity, 4);
      const fillQty = remaining < makerQty ? remaining : makerQty;
      await this.fill(m, order, maker, fillQty);
    }
    if (
      input.type === 'MARKET' &&
      balanceUnits(order.remaining_quantity, 4) > 0n
    )
      await this.release(m, order);
    return order;
  }

  private async fill(m: EntityManager, taker: any, maker: any, qty: bigint) {
    const buy = taker.side === 'BUY' ? taker : maker,
      sell = taker.side === 'SELL' ? taker : maker;
    const price = balanceUnits(maker.price, 2),
      budget = balanceUnits(buy.price, 2) * qty,
      cost = price * qty;
    const q = decimal(qty, 4),
      c = decimal(cost, 6),
      b = decimal(budget, 6),
      improvement = decimal(budget - cost, 6);
    const tradeId = randomUUID();
    await m.query(
      `UPDATE wallets SET frozen_balance=frozen_balance-$2,balance=balance+$3,updated_at=now() WHERE user_id=$1`,
      [buy.user_id, b, improvement],
    );
    await m.query(
      'UPDATE wallets SET balance=balance+$2,updated_at=now() WHERE user_id=$1',
      [sell.user_id, c],
    );
    await m.query(
      `UPDATE holding SET frozen_quantity=frozen_quantity-$3,
      realized_pnl=realized_pnl+round(($4::numeric-average_buy_price)*$3::numeric,6)
      WHERE user_id=$1 AND asset_id=$2`,
      [sell.user_id, sell.asset_id, q, decimal(price, 2)],
    );
    await m.query(
      `INSERT INTO holding(user_id,asset_id,quantity,frozen_quantity,average_buy_price)
      VALUES($1,$2,$3,0,$4) ON CONFLICT(user_id,asset_id) DO UPDATE SET
      average_buy_price=((holding.quantity+holding.frozen_quantity)*holding.average_buy_price+$3::numeric*$4::numeric)
        /(holding.quantity+holding.frozen_quantity+$3::numeric), quantity=holding.quantity+$3::numeric`,
      [buy.user_id, buy.asset_id, q, decimal(price, 2)],
    );
    for (const order of [buy, sell]) {
      order.remaining_quantity = decimal(
        balanceUnits(order.remaining_quantity, 4) - qty,
        4,
      );
      order.status =
        balanceUnits(order.remaining_quantity, 4) === 0n
          ? 'FILLED'
          : 'PARTIALLY_FILLED';
      order.reserved_cash = decimal(
        balanceUnits(order.reserved_cash, 6) -
          (order.side === 'BUY' ? budget : 0n),
        6,
      );
      order.reserved_quantity = decimal(
        balanceUnits(order.reserved_quantity, 4) -
          (order.side === 'SELL' ? qty : 0n),
        4,
      );
      await m.query(
        `UPDATE orders SET remaining_quantity=$2,status=$3,reserved_cash=$4,reserved_quantity=$5,updated_at=now() WHERE id=$1`,
        [
          order.id,
          order.remaining_quantity,
          order.status,
          order.reserved_cash,
          order.reserved_quantity,
        ],
      );
    }
    await m.query(
      `INSERT INTO trades(id,asset_id,price,quantity,buyer_id,seller_id,buy_order_id,sell_order_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        tradeId,
        buy.asset_id,
        decimal(price, 2),
        q,
        buy.user_id,
        sell.user_id,
        buy.id,
        sell.id,
      ],
    );
    await m.query('INSERT INTO price_history(asset_id,price) VALUES($1,$2)', [
      buy.asset_id,
      decimal(price, 2),
    ]);
    await this.ledger(
      m,
      buy.user_id,
      null,
      buy.id,
      tradeId,
      'fill',
      improvement,
      decimal(-budget, 6),
    );
    await this.ledger(m, sell.user_id, null, sell.id, tradeId, 'fill', c, '0');
    await this.ledger(
      m,
      buy.user_id,
      buy.asset_id,
      buy.id,
      tradeId,
      'fill',
      q,
      '0',
    );
    await this.ledger(
      m,
      sell.user_id,
      sell.asset_id,
      sell.id,
      tradeId,
      'fill',
      '0',
      decimal(-qty, 4),
    );
    await this.event(m, buy.asset_id, 'trade', {
      tradeId,
      price: decimal(price, 2),
      quantity: q,
    });
  }

  private async release(m: EntityManager, order: any) {
    if (order.side === 'BUY') {
      await m.query(
        'UPDATE wallets SET balance=balance+$2,frozen_balance=frozen_balance-$2,updated_at=now() WHERE user_id=$1',
        [order.user_id, order.reserved_cash],
      );
      await this.ledger(
        m,
        order.user_id,
        null,
        order.id,
        null,
        'release',
        order.reserved_cash,
        decimal(-balanceUnits(order.reserved_cash, 6), 6),
      );
    } else {
      await m.query(
        'UPDATE holding SET quantity=quantity+$3,frozen_quantity=frozen_quantity-$3 WHERE user_id=$1 AND asset_id=$2',
        [order.user_id, order.asset_id, order.reserved_quantity],
      );
      await this.ledger(
        m,
        order.user_id,
        order.asset_id,
        order.id,
        null,
        'release',
        order.reserved_quantity,
        decimal(-balanceUnits(order.reserved_quantity, 4), 4),
      );
    }
    order.status = 'CANCELLED';
    order.reserved_cash = '0';
    order.reserved_quantity = '0';
    await m.query(
      "UPDATE orders SET status='CANCELLED',reserved_cash=0,reserved_quantity=0,updated_at=now() WHERE id=$1",
      [order.id],
    );
  }

  async cancel(user: string, key: string, id: string) {
    return this.command(user, key, { action: 'cancel', id }, async (m) => {
      const [order] = await m.query(
        'SELECT * FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [id, user],
      );
      if (!order) throw new NotFoundException('Order not found');
      if (!['OPEN', 'PARTIALLY_FILLED'].includes(order.status))
        throw new ConflictException('Order is already closed');
      await this.release(m, order);
      await this.event(m, order.asset_id, 'book', {
        book: await this.book(m, order.asset_id),
      });
      return {
        orderId: id,
        status: order.status,
        remainingQuantity: order.remaining_quantity,
      };
    });
  }

  async issue(
    admin: string,
    key: string,
    assetId: string,
    price: string | number,
    supply: string | number,
    percentage: string | number,
  ) {
    const p = units(price, 2),
      total = units(supply, 4),
      pct = units(percentage, 2, false);
    if (pct > 10000n)
      throw new BadRequestException(
        'Creator percentage must be between 0 and 100',
      );
    return this.command(
      admin,
      key,
      {
        action: 'issue',
        assetId,
        price: decimal(p, 2),
        supply: decimal(total, 4),
        percentage: decimal(pct, 2),
      },
      async (m) => {
        const [asset] = await m.query(
          'SELECT * FROM assets WHERE id=$1 FOR UPDATE',
          [assetId],
        );
        if (!asset) throw new NotFoundException('Asset not found');
        if (asset.status !== 'pending')
          throw new ConflictException('Only pending assets can be issued');
        const [user] = await m.query(
          "SELECT u.id FROM users u JOIN wallets w ON w.user_id=u.id WHERE u.id=$1 AND u.role='admin'",
          [admin],
        );
        if (!user) throw new BadRequestException('Administrator required');
        const creator = (total * pct) / 10000n,
          platform = total - creator;
        for (const [owner, qty] of [
          [asset.submitted_by_user_id, creator],
          [admin, platform],
        ] as [string, bigint][]) {
          if (!qty) continue;
          await m.query(
            `INSERT INTO holding(user_id,asset_id,quantity) VALUES($1,$2,$3)
          ON CONFLICT(user_id,asset_id) DO UPDATE SET quantity=holding.quantity+$3::numeric`,
            [owner, assetId, decimal(qty, 4)],
          );
          await this.ledger(
            m,
            owner,
            assetId,
            null,
            null,
            'issuance',
            decimal(qty, 4),
            '0',
          );
        }
        await m.query(
          `UPDATE assets SET status='approved',initial_price=$2,total_supply=$3,creator_split_percentage=$4,updated_at=now() WHERE id=$1`,
          [assetId, decimal(p, 2), decimal(total, 4), decimal(pct, 2)],
        );
        if (platform > 0n)
          await this.admit(m, admin, {
            assetId,
            side: 'SELL',
            type: 'LIMIT',
            price: decimal(p, 2),
            quantity: decimal(platform, 4),
          });
        await this.event(m, assetId, 'book', {
          book: await this.book(m, assetId),
        });
        return (
          await m.query('SELECT * FROM assets WHERE id=$1', [assetId])
        )[0];
      },
    );
  }

  async news(
    admin: string,
    key: string,
    input: { assetId: string; headline: string; sentiment: number },
  ) {
    if (
      typeof input.headline !== 'string' ||
      !input.headline.trim() ||
      input.headline.length > 500 ||
      !Number.isInteger(input.sentiment) ||
      input.sentiment < 0 ||
      input.sentiment > 100
    )
      throw new BadRequestException('Invalid news headline or sentiment');
    return this.command(admin, key, { action: 'news', ...input }, async (m) => {
      const [user] = await m.query(
        "SELECT id FROM users WHERE id=$1 AND role='admin'",
        [admin],
      );
      const [asset] = await m.query(
        "SELECT id FROM assets WHERE id=$1 AND status='approved'",
        [input.assetId],
      );
      if (!user || !asset)
        throw new BadRequestException(
          'Administrator and approved asset required',
        );
      await this.event(m, input.assetId, 'news', {
        headline: input.headline,
        sentiment: input.sentiment,
      });
      return { success: true, message: 'News recorded' };
    });
  }
}
