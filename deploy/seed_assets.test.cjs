const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const path = require("node:path");
const {
  validate,
  stableId,
  issuer,
  seedCatalogue,
} = require("./seed_assets.cjs");
const catalogue = require("./starter-assets.json");

test("starter data matches the approved shortlist with valid, unique instrument fields", () => {
  validate(catalogue);
  const shortlist = require("node:fs").readFileSync(
    path.join(__dirname, "../docs/ASSET_SHORTLIST.md"),
    "utf8",
  );
  const names = [...shortlist.matchAll(/^\| \d{2} \| ([^|]+) \|/gm)].map(
    (match) => match[1].trim(),
  );
  assert.deepEqual(
    catalogue.assets.map((a) => a.name),
    names,
  );
  assert.equal(names.length, 60);
  assert.equal(new Set(catalogue.assets.map((a) => stableId(a.key))).size, 60);
});

test(
  "import and retries preserve issuance, reservations, template versions and subsequent trades",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const serviceRequire = createRequire(
      path.join(__dirname, "../services/trading_service/package.json"),
    );
    const { DataSource } = serviceRequire("typeorm");
    const { Client } = serviceRequire("pg");
    const { ExchangeService } = serviceRequire(
      "./dist/exchange/exchange.service",
    );
    const { ResearchService } = serviceRequire(
      "./dist/research/research.service",
    );
    const { AtomicExchange1790101000000 } = serviceRequire(
      "./dist/exchange/schema",
    );
    const { ExchangeClock1790460000000 } = serviceRequire(
      "./dist/exchange/clock-schema",
    );
    const { Research1790461000000 } = serviceRequire("./dist/research/schema");
    const schema = `catalogue_test_${randomUUID().replaceAll("-", "")}`;
    const client = new Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    let db;
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      db = new DataSource({
        type: "postgres",
        url: process.env.TEST_DATABASE_URL,
        extra: { options: `-c search_path=${schema}` },
      });
      await db.initialize();
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        for (const Migration of [
          AtomicExchange1790101000000,
          ExchangeClock1790460000000,
          Research1790461000000,
        ])
          await new Migration().up(runner);
        await runner.commitTransaction();
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      } finally {
        await runner.release();
      }
      const options = { apply: true, ExchangeService, ResearchService };
      assert.equal((await seedCatalogue(db, catalogue)).create, 60);
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM users"))[0].n,
        0,
      );
      assert.equal((await seedCatalogue(db, catalogue, options)).issued, 60);
      const counts = async () =>
        (
          await db.query(`SELECT
      (SELECT count(*)::int FROM assets) AS assets,
      (SELECT count(*)::int FROM orders) AS orders,
      (SELECT count(*)::int FROM exchange_commands) AS commands,
      (SELECT count(*)::int FROM exchange_ledger) AS ledger,
      (SELECT sum(version)::int FROM research_templates) AS versions`)
        )[0];
      const initial = await counts();
      assert.equal(initial.assets, 60);
      assert.equal(initial.orders, 60);
      assert.equal(initial.commands, 60);
      assert.equal(initial.versions, 60);
      assert.equal((await seedCatalogue(db, catalogue, options)).issued, 0);
      assert.deepEqual(await counts(), initial);
      assert.equal(
        (
          await db.query("SELECT balance::text FROM wallets WHERE user_id=$1", [
            issuer.id,
          ])
        )[0].balance,
        "0.000000",
      );
      assert.equal(
        (
          await db.query(
            "SELECT sum(quantity+frozen_quantity)::text AS n FROM holding",
          )
        )[0].n,
        "600000.00000000",
      );

      const buyer = randomUUID();
      await db.query(
        "INSERT INTO users(id,email,username,password_hash) VALUES($1,'buyer@test.invalid','buyer','!')",
        [buyer],
      );
      await db.query("INSERT INTO wallets(user_id,balance) VALUES($1,10000)", [
        buyer,
      ]);
      await db.query(
        "INSERT INTO exchange_ledger(user_id,reason,available_delta,reserved_delta) VALUES($1,'endowment',10000,0)",
        [buyer],
      );
      const first = catalogue.assets[0];
      await new ExchangeService(db.manager).place(buyer, "catalogue-test-buy", {
        assetId: stableId(first.key),
        side: "BUY",
        type: "MARKET",
        price: first.initialPrice,
        quantity: "2.0000",
      });
      const afterTrade = await db.query(
        "SELECT id,remaining_quantity,reserved_quantity,status FROM orders ORDER BY sequence",
      );
      const balances = await db.query(
        "SELECT user_id,balance,frozen_balance FROM wallets ORDER BY user_id",
      );
      await seedCatalogue(db, catalogue, options);
      assert.deepEqual(
        await db.query(
          "SELECT id,remaining_quantity,reserved_quantity,status FROM orders ORDER BY sequence",
        ),
        afterTrade,
      );
      assert.deepEqual(
        await db.query(
          "SELECT user_id,balance,frozen_balance FROM wallets ORDER BY user_id",
        ),
        balances,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM trades"))[0].n,
        1,
      );

      const changed = structuredClone(catalogue);
      changed.assets[59].initialPrice = "999.00";
      const beforeConflict = await counts();
      await assert.rejects(
        seedCatalogue(db, changed, options),
        /conflicts with catalogue/,
      );
      assert.deepEqual(await counts(), beforeConflict);
    } finally {
      if (db?.isInitialized) await db.destroy();
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      await client.end();
    }
  },
);
