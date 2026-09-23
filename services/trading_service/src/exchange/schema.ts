import { MigrationInterface, QueryRunner } from 'typeorm';

/** One schema owner. Stop all old services before upgrading an existing database. */
export class AtomicExchange1790101000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar NOT NULL UNIQUE,
        username varchar NOT NULL UNIQUE, role varchar NOT NULL DEFAULT 'user', password_hash varchar NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS wallets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
        balance numeric(24,6) NOT NULL DEFAULT 10000, frozen_balance numeric(24,6) NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS assets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, description text NOT NULL,
        "imageUrl" text, initial_price numeric(12,2), total_supply numeric(12,4),
        creator_split_percentage numeric(5,2), status varchar NOT NULL DEFAULT 'pending',
        submitted_by_user_id uuid NOT NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS holding (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, asset_id uuid NOT NULL,
        quantity numeric(18,8) NOT NULL DEFAULT 0, frozen_quantity numeric(18,8) NOT NULL DEFAULT 0,
        average_buy_price numeric(18,8) NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, asset_id uuid NOT NULL,
        side varchar NOT NULL, type varchar NOT NULL, status varchar NOT NULL DEFAULT 'OPEN',
        price numeric(12,2) NOT NULL, initial_quantity numeric(12,4) NOT NULL, remaining_quantity numeric(12,4) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS trades (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_id uuid NOT NULL, price numeric(12,2) NOT NULL,
        quantity numeric(12,4) NOT NULL, buyer_id uuid NOT NULL, seller_id uuid NOT NULL,
        buy_order_id uuid, sell_order_id uuid, timestamp timestamp NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS price_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_id varchar NOT NULL,
        price numeric(12,2) NOT NULL, timestamp timestamp NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS liquidity_pool (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_id uuid NOT NULL,
        asset_balance numeric NOT NULL DEFAULT 0, currency_balance numeric NOT NULL DEFAULT 0);
    `);
    const [legacy] = await q.query(`SELECT
      (SELECT count(*) FROM orders WHERE status IN ('OPEN','PARTIALLY_FILLED')) +
      (SELECT count(*) FROM wallets WHERE frozen_balance <> 0) +
      (SELECT count(*) FROM holding WHERE frozen_quantity <> 0 OR quantity <> trunc(quantity,4)) AS count`);
    if (Number(legacy.count))
      throw new Error(
        'Legacy open orders/reservations require reconciliation before upgrade. See docs/EXCHANGE_OPERATIONS.md; no balances have been changed.',
      );
    await q.query(`
      ALTER TABLE wallets ALTER COLUMN balance TYPE numeric(24,6), ALTER COLUMN frozen_balance TYPE numeric(24,6);
      CREATE UNIQUE INDEX IF NOT EXISTS exchange_wallet_user ON wallets(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS exchange_holding_user_asset ON holding(user_id,asset_id);
      ALTER TABLE wallets ADD CONSTRAINT exchange_cash_nonnegative CHECK (balance >= 0 AND frozen_balance >= 0);
      ALTER TABLE holding ADD CONSTRAINT exchange_holdings_nonnegative CHECK (quantity >= 0 AND frozen_quantity >= 0);
      ALTER TABLE orders ADD COLUMN sequence bigserial;
      ALTER TABLE orders ADD COLUMN reserved_cash numeric(24,6) NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN reserved_quantity numeric(18,4) NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD CONSTRAINT exchange_order_reservations CHECK (reserved_cash >= 0 AND reserved_quantity >= 0);
      ALTER TABLE orders ADD CONSTRAINT exchange_order_quantity CHECK (remaining_quantity >= 0 AND remaining_quantity <= initial_quantity);
      ALTER TABLE wallets ADD CONSTRAINT exchange_wallet_owner FOREIGN KEY(user_id) REFERENCES users(id);
      ALTER TABLE holding ADD CONSTRAINT exchange_holding_owner FOREIGN KEY(user_id) REFERENCES users(id);
      ALTER TABLE holding ADD CONSTRAINT exchange_holding_asset FOREIGN KEY(asset_id) REFERENCES assets(id);
      ALTER TABLE orders ADD CONSTRAINT exchange_order_owner FOREIGN KEY(user_id) REFERENCES users(id);
      ALTER TABLE orders ADD CONSTRAINT exchange_order_asset FOREIGN KEY(asset_id) REFERENCES assets(id);
      ALTER TABLE holding ADD COLUMN realized_pnl numeric(24,6) NOT NULL DEFAULT 0;
      ALTER TABLE trades ADD COLUMN sequence bigserial;
      ALTER TABLE price_history ADD COLUMN sequence bigserial;
      CREATE INDEX exchange_matching ON orders(asset_id,side,price,sequence) WHERE status IN ('OPEN','PARTIALLY_FILLED');
      CREATE INDEX exchange_user_orders ON orders(user_id,sequence);
      CREATE INDEX IF NOT EXISTS exchange_asset_trades ON trades(asset_id,timestamp);
      CREATE UNIQUE INDEX exchange_trade_sequence ON trades(sequence);
      CREATE INDEX exchange_asset_trade_sequence ON trades(asset_id,sequence DESC);
      CREATE TABLE exchange_commands (
        user_id uuid NOT NULL, key varchar(128) NOT NULL, request jsonb NOT NULL, response jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,key));
      CREATE TABLE exchange_events (
        sequence bigserial PRIMARY KEY, asset_id uuid NOT NULL, type varchar NOT NULL,
        payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz);
      CREATE INDEX exchange_event_pending ON exchange_events(sequence) WHERE published_at IS NULL;
      CREATE INDEX exchange_event_latest ON exchange_events(type,asset_id,sequence DESC);
      CREATE TABLE exchange_ledger (
        sequence bigserial PRIMARY KEY, user_id uuid NOT NULL, asset_id uuid,
        order_id uuid, trade_id uuid, reason varchar NOT NULL,
        available_delta numeric(24,6) NOT NULL, reserved_delta numeric(24,6) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO exchange_ledger(user_id,reason,available_delta,reserved_delta)
        SELECT user_id,'legacy-opening',balance,frozen_balance FROM wallets;
      INSERT INTO exchange_ledger(user_id,asset_id,reason,available_delta,reserved_delta)
        SELECT user_id,asset_id,'legacy-opening',quantity,frozen_quantity FROM holding;
    `);
  }
  async down(): Promise<void> {
    throw new Error(
      'Restore a verified database backup to roll back an accounting migration.',
    );
  }
}
