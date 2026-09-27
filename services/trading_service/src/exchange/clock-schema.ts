import { MigrationInterface, QueryRunner } from 'typeorm';

/** Transaction-local setting prevents a controlled clock leaking through pooled connections. */
export class ExchangeClock1790460000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE FUNCTION exchange_now() RETURNS timestamptz LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('stonks.logical_time',true),'')::timestamptz,now()) $$`);
    for (const [table, columns] of Object.entries({
      users: ['created_at', 'updated_at'],
      wallets: ['created_at', 'updated_at'],
      assets: ['created_at', 'updated_at'],
      orders: ['created_at', 'updated_at'],
      trades: ['timestamp'],
      price_history: ['timestamp'],
      exchange_commands: ['created_at'],
      exchange_events: ['created_at'],
      exchange_ledger: ['created_at'],
    }))
      for (const column of columns)
        await q.query(
          `ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT exchange_now()`,
        );
  }
  async down() {
    throw new Error(
      'Restore a verified backup to reverse an exchange migration.',
    );
  }
}
