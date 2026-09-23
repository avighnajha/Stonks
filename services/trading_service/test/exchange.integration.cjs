// Runs the real compiled engine and migrations against an isolated PostgreSQL schema.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const { ExchangeService } = require('../dist/exchange/exchange.service');
const { AtomicExchange1790101000000 } = require('../dist/exchange/schema');
const { OutboxService } = require('../dist/exchange/outbox.service');
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error(
    'Set TEST_DATABASE_URL to a disposable PostgreSQL database; tests create their own schema.',
  );
const schema = `exchange_test_${randomUUID().replaceAll('-', '')}`;
const buyer = randomUUID(),
  seller = randomUUID(),
  other = randomUUID(),
  asset = randomUUID(),
  asset2 = randomUUID();
let db, engine, client;
before(async () => {
  client = new Client({ connectionString: url });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  db = new DataSource({
    type: 'postgres',
    url,
    extra: { options: `-c search_path=${schema}`, max: 20 },
  });
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await new AtomicExchange1790101000000().up(runner);
    await runner.commitTransaction();
  } catch (e) {
    await runner.rollbackTransaction();
    throw e;
  } finally {
    await runner.release();
  }
  engine = new ExchangeService(db.manager);
});
after(async () => {
  if (db?.isInitialized) await db.destroy();
  if (client) {
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  }
});
beforeEach(async () => {
  await db.query(
    'TRUNCATE exchange_commands,exchange_events,exchange_ledger,trades,orders,price_history,holding,wallets,assets,users RESTART IDENTITY',
  );
  for (const [id, name] of [
    [buyer, 'buyer'],
    [seller, 'seller'],
    [other, 'other'],
  ]) {
    await db.query(
      "INSERT INTO users(id,email,username,password_hash,role) VALUES($1,$2,$2,'test','admin')",
      [id, name],
    );
    await db.query('INSERT INTO wallets(user_id,balance) VALUES($1,10000)', [
      id,
    ]);
    await db.query(
      "INSERT INTO exchange_ledger(user_id,reason,available_delta,reserved_delta) VALUES($1,'endowment',10000,0)",
      [id],
    );
  }
  for (const id of [asset, asset2]) {
    await db.query(
      "INSERT INTO assets(id,name,description,status,submitted_by_user_id,total_supply) VALUES($1::uuid,$1::text,'test','approved',$2,100)",
      [id, seller],
    );
    await db.query(
      'INSERT INTO holding(user_id,asset_id,quantity,average_buy_price) VALUES($1,$2,100,20)',
      [seller, id],
    );
    await db.query(
      "INSERT INTO exchange_ledger(user_id,asset_id,reason,available_delta,reserved_delta) VALUES($1,$2,'issuance',100,0)",
      [seller, id],
    );
  }
});
const place = (user, side, price, quantity, options = {}) =>
  engine.place(user, options.key || randomUUID(), {
    assetId: options.asset || asset,
    side,
    type: options.type || 'LIMIT',
    price,
    quantity,
  });
async function invariants() {
  const [cash] = await db.query(
    'SELECT sum(balance+frozen_balance)::text AS total FROM wallets',
  );
  assert.equal(Number(cash.total), 30000);
  const badWallets =
    await db.query(`SELECT w.user_id FROM wallets w WHERE w.frozen_balance <>
    COALESCE((SELECT sum(reserved_cash) FROM orders WHERE user_id=w.user_id),0)`);
  assert.equal(badWallets.length, 0, 'cash reservations must belong to orders');
  const badHoldings =
    await db.query(`SELECT h.id FROM holding h WHERE h.frozen_quantity <>
    COALESCE((SELECT sum(reserved_quantity) FROM orders WHERE user_id=h.user_id AND asset_id=h.asset_id),0)`);
  assert.equal(
    badHoldings.length,
    0,
    'asset reservations must belong to orders',
  );
  const supplies = await db.query(
    'SELECT asset_id,sum(quantity+frozen_quantity)::text AS total FROM holding GROUP BY asset_id',
  );
  for (const s of supplies) assert.equal(Number(s.total), 100);
  const ledger =
    await db.query(`SELECT w.user_id FROM wallets w WHERE w.balance <>
    COALESCE((SELECT sum(available_delta) FROM exchange_ledger WHERE user_id=w.user_id AND asset_id IS NULL),0)
    OR w.frozen_balance <> COALESCE((SELECT sum(reserved_delta) FROM exchange_ledger WHERE user_id=w.user_id AND asset_id IS NULL),0)`);
  assert.equal(ledger.length, 0, 'cash ledger must reconcile');
  const assets = await db.query(`SELECT h.id FROM holding h WHERE h.quantity <>
    COALESCE((SELECT sum(available_delta) FROM exchange_ledger WHERE user_id=h.user_id AND asset_id=h.asset_id),0)
    OR h.frozen_quantity <> COALESCE((SELECT sum(reserved_delta) FROM exchange_ledger WHERE user_id=h.user_id AND asset_id=h.asset_id),0)`);
  assert.equal(assets.length, 0, 'asset ledger must reconcile');
}
test('price improvement releases every unused unit of cash and records cost basis', async () => {
  await place(seller, 'SELL', '90', '10');
  const order = await place(buyer, 'BUY', '100', '10');
  assert.equal(order.status, 'FILLED');
  const [w] = await db.query('SELECT * FROM wallets WHERE user_id=$1', [buyer]);
  assert.equal(w.balance, '9100.000000');
  assert.equal(w.frozen_balance, '0.000000');
  const [h] = await db.query('SELECT * FROM holding WHERE user_id=$1', [buyer]);
  assert.equal(h.average_buy_price, '90.00000000');
  await invariants();
});
test('FIFO, partial fill, cancellation and private ownership', async () => {
  const first = await place(seller, 'SELL', 90, 4),
    second = await place(seller, 'SELL', 90, 7);
  const buy = await place(buyer, 'BUY', 100, 6);
  const info = await engine.order(buyer, buy.orderId);
  assert.equal(info.fills.length, 2);
  assert.equal((await engine.order(seller, first.orderId)).status, 'FILLED');
  assert.equal(
    (await engine.order(seller, second.orderId)).remaining_quantity,
    '5.0000',
  );
  await assert.rejects(engine.order(other, buy.orderId));
  await assert.rejects(engine.cancel(other, randomUUID(), second.orderId));
  await engine.cancel(seller, randomUUID(), second.orderId);
  await invariants();
});
test('market orders never rest or breach protection price, including empty books', async () => {
  const empty = await place(buyer, 'BUY', 10, 1, { type: 'MARKET' });
  assert.equal(empty.status, 'CANCELLED');
  await place(seller, 'SELL', 50, 2);
  const protectedBuy = await place(buyer, 'BUY', 10, 1, { type: 'MARKET' });
  assert.equal(protectedBuy.filledQuantity, '0.0000');
  const partial = await place(buyer, 'BUY', 60, 3, { type: 'MARKET' });
  assert.equal(partial.status, 'CANCELLED');
  assert.equal(partial.filledQuantity, '2.0000');
  assert.equal(
    (
      await db.query(
        "SELECT * FROM orders WHERE type='MARKET' AND status IN ('OPEN','PARTIALLY_FILLED')",
      )
    ).length,
    0,
  );
  await invariants();
});
test('fractional settlement does not round away cash', async () => {
  await place(seller, 'SELL', '0.01', '0.0001');
  await place(buyer, 'BUY', '0.01', '0.0001');
  const [w] = await db.query('SELECT balance FROM wallets WHERE user_id=$1', [
    buyer,
  ]);
  assert.equal(w.balance, '9999.999999');
  await invariants();
});
test('duplicate concurrent requests execute once; conflicting reuse fails', async () => {
  const key = randomUUID();
  const [a, b] = await Promise.all([
    place(buyer, 'BUY', 10, 2, { key }),
    place(buyer, 'BUY', 10, 2, { key }),
  ]);
  assert.deepEqual(a, b);
  await assert.rejects(place(buyer, 'BUY', 10, 3, { key }));
  const cancelKey = randomUUID();
  assert.deepEqual(
    await engine.cancel(buyer, cancelKey, a.orderId),
    await engine.cancel(buyer, cancelKey, a.orderId),
  );
  await invariants();
});
test('cross-asset competing reservations cannot overspend', async () => {
  const results = await Promise.allSettled([
    place(buyer, 'BUY', 100, 75),
    place(buyer, 'BUY', 100, 75, { asset: asset2 }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  await invariants();
});
test('simultaneous empty-book arrivals match, and self orders never match', async () => {
  await Promise.all([
    place(buyer, 'BUY', 100, 1),
    place(seller, 'SELL', 90, 1),
  ]);
  assert.equal((await db.query('SELECT * FROM trades')).length, 1);
  await place(seller, 'BUY', 100, 1);
  await place(seller, 'SELL', 90, 1);
  assert.equal(
    (await db.query('SELECT * FROM trades WHERE buyer_id=seller_id')).length,
    0,
  );
  await invariants();
});
test('failure after accounting changes rolls back balances, orders, ledger and events', async () => {
  await place(seller, 'SELL', 90, 10);
  const before = await db.query('SELECT * FROM wallets ORDER BY id');
  await db.query(`CREATE FUNCTION fail_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$;
    CREATE TRIGGER fail_event BEFORE INSERT ON exchange_events FOR EACH ROW EXECUTE FUNCTION fail_event()`);
  try {
    await assert.rejects(place(buyer, 'BUY', 100, 10), /injected failure/);
  } finally {
    await db.query(
      'DROP TRIGGER fail_event ON exchange_events; DROP FUNCTION fail_event()',
    );
  }
  assert.deepEqual(await db.query('SELECT * FROM wallets ORDER BY id'), before);
  assert.equal((await db.query('SELECT * FROM trades')).length, 0);
  await invariants();
});
test('committed events replay in order and public books omit participant identities', async () => {
  await place(seller, 'SELL', 90, 2);
  const snap = await engine.snapshot(asset);
  assert.equal(snap.book.sells[0].quantity, '2.0000');
  assert.ok(!JSON.stringify(snap).includes(seller));
  await place(buyer, 'BUY', 100, 1);
  const replay = await engine.events(snap.cursor);
  assert.deepEqual(
    replay.events.map((e) => e.type),
    ['trade', 'book'],
  );
  assert.ok(!JSON.stringify(replay).includes(buyer));
  assert.ok(!JSON.stringify(replay).includes(seller));
  await invariants();
});
test('randomized command histories preserve cash, supply and order reservations', async () => {
  let seed = 41;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const users = [buyer, seller, other];
  for (let i = 0; i < 150; i++) {
    const user = users[Math.floor(rand() * 3)];
    try {
      if (rand() < 0.25) {
        const orders = await engine.orders(user);
        const open = orders.find((o) =>
          ['OPEN', 'PARTIALLY_FILLED'].includes(o.status),
        );
        if (open) await engine.cancel(user, randomUUID(), open.id);
      } else
        await place(
          user,
          rand() < 0.5 ? 'BUY' : 'SELL',
          80 + Math.floor(rand() * 40),
          1 + Math.floor(rand() * 4),
          {
            type: rand() < 0.3 ? 'MARKET' : 'LIMIT',
            asset: rand() < 0.5 ? asset : asset2,
          },
        );
    } catch (e) {
      if (!/Insufficient/.test(e.message)) throw e;
    }
    await invariants();
  }
});

test('issuance is atomic and idempotent, including zero creator allocation', async () => {
  const id = randomUUID();
  await db.query(
    "INSERT INTO assets(id,name,description,submitted_by_user_id) VALUES($1,'new','test',$2)",
    [id, seller],
  );
  const key = randomUUID();
  const issued = await engine.issue(buyer, key, id, '10', '1000', '0');
  assert.deepEqual(
    await engine.issue(buyer, key, id, '10', '1000', '0'),
    issued,
  );
  await assert.rejects(
    engine.issue(other, randomUUID(), id, '10', '1000', '0'),
  );
  const [supply] = await db.query(
    'SELECT sum(quantity+frozen_quantity)::text AS total FROM holding WHERE asset_id=$1',
    [id],
  );
  assert.equal(Number(supply.total), 1000);
  const [order] = await db.query('SELECT * FROM orders WHERE asset_id=$1', [
    id,
  ]);
  assert.equal(order.reserved_quantity, '1000.0000');
});
test('outbox failure preserves durable events, and restart retries do not duplicate a command', async () => {
  const key = randomUUID();
  const original = await place(seller, 'SELL', 90, 2, { key });
  let fail = true;
  const delivered = [];
  const worker = new OutboxService(db.manager, {
    publishEvent: async (e) => {
      if (fail) throw new Error('offline');
      delivered.push(e);
    },
  });
  await worker.flush();
  assert.equal(
    (await db.query('SELECT * FROM exchange_events WHERE published_at IS NULL'))
      .length,
    1,
  );
  fail = false;
  await worker.flush();
  await worker.flush();
  assert.equal(delivered.length, 1);
  const restarted = new ExchangeService(db.manager);
  assert.deepEqual(
    await restarted.place(seller, key, {
      assetId: asset,
      side: 'SELL',
      type: 'LIMIT',
      price: 90,
      quantity: 2,
    }),
    original,
  );
  await invariants();
});

test('concurrent cancellation and fill cannot spend the same reservation twice', async () => {
  const resting = await place(seller, 'SELL', 90, 10);
  await Promise.allSettled([
    engine.cancel(seller, randomUUID(), resting.orderId),
    place(buyer, 'BUY', 100, 10),
  ]);
  await invariants();
  const detail = await engine.order(seller, resting.orderId);
  assert.ok(['CANCELLED', 'FILLED'].includes(detail.status));
});
test('portfolio and leaderboard retain reserved assets and cash in wealth', async () => {
  await db.query('UPDATE assets SET initial_price=90 WHERE id=$1', [asset]);
  const before = await engine.leaderboard();
  await place(seller, 'SELL', 90, 10);
  await place(buyer, 'BUY', 80, 10);
  assert.deepEqual(await engine.leaderboard(), before);
  const account = await engine.account(seller);
  const position = account.positions.find((p) => p.assetId === asset);
  assert.equal(Number(position.quantity), 100);
  assert.equal(Number(position.reservedQuantity), 10);
  await invariants();
});
test('news validates inputs and replays once across retries', async () => {
  const key = randomUUID(),
    news = { assetId: asset, headline: 'Information shock', sentiment: 75 };
  await engine.news(buyer, key, news);
  await engine.news(buyer, key, news);
  assert.equal(
    (await engine.feedSnapshot()).events.filter((e) => e.type === 'news')
      .length,
    1,
  );
  await assert.rejects(
    engine.news(buyer, randomUUID(), { ...news, sentiment: NaN }),
  );
  await assert.rejects(
    engine.news(buyer, key, { ...news, headline: 'different' }),
  );
});
