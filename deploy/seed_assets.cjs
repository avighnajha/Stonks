// Operator-only catalogue import. Issuance always goes through the exchange engine.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");

function stableId(name) {
  const bytes = createHash("sha1")
    .update(Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex"))
    .update(`stonks.invalid/starter-v1/${name}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  return bytes
    .toString("hex")
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
}
const issuer = {
  id: stableId("treasury"),
  email: "treasury@stonks.invalid",
  username: "Stonks Treasury",
};

function validate(catalogue) {
  if (
    catalogue?.version !== 1 ||
    catalogue.creatorPercentage !== "0.00" ||
    !/^\d{1,8}\.\d{4}$/.test(catalogue.totalSupply) ||
    Number(catalogue.totalSupply) < 1 ||
    !Array.isArray(catalogue.assets) ||
    !catalogue.assets.length ||
    catalogue.assets.length > 500
  )
    throw Error("Invalid catalogue version, supply, allocation or asset count");
  const names = new Set(),
    keys = new Set();
  for (const a of catalogue.assets) {
    for (const [field, min, max] of [
      ["name", 2, 30],
      ["description", 5, 240],
      ["sector", 1, 80],
      ["subsector", 1, 80],
    ]) {
      if (
        typeof a[field] !== "string" ||
        a[field] !== a[field].trim() ||
        a[field].length < min ||
        a[field].length > max
      )
        throw Error(`Invalid ${field} for asset ${a.key}`);
    }
    if (
      typeof a.key !== "string" ||
      !/^[a-z0-9-]{1,64}$/.test(a.key) ||
      keys.has(a.key) ||
      names.has(a.name.toLowerCase()) ||
      !/^\d{1,10}\.\d{2}$/.test(a.initialPrice) ||
      Number(a.initialPrice) <= 0
    )
      throw Error(`Duplicate key/name or invalid price for asset ${a.key}`);
    keys.add(a.key);
    names.add(a.name.toLowerCase());
  }
  return catalogue;
}

async function preflight(db, catalogue) {
  validate(catalogue);
  const accounts = await db.query(
    "SELECT * FROM users WHERE id=$1 OR email=$2 OR username=$3",
    [issuer.id, issuer.email, issuer.username],
  );
  if (
    accounts.length &&
    (accounts.length !== 1 ||
      accounts[0].id !== issuer.id ||
      accounts[0].email !== issuer.email ||
      accounts[0].username !== issuer.username ||
      accounts[0].role !== "admin" ||
      accounts[0].password_hash !== "!")
  )
    throw Error(
      "Treasury identity conflicts with an existing account; no changes made",
    );
  const assets = await db.query(
    "SELECT * FROM assets WHERE name=ANY($1::text[]) OR id=ANY($2::uuid[])",
    [
      catalogue.assets.map((a) => a.name),
      catalogue.assets.map((a) => stableId(a.key)),
    ],
  );
  for (const a of catalogue.assets) {
    const existing = assets.filter(
      (row) => row.name === a.name || row.id === stableId(a.key),
    );
    if (!existing.length) continue;
    const row = existing[0];
    if (
      existing.length !== 1 ||
      row.id !== stableId(a.key) ||
      row.name !== a.name ||
      row.submitted_by_user_id !== issuer.id ||
      !["pending", "approved"].includes(row.status) ||
      (row.status === "approved" &&
        (Number(row.initial_price) !== Number(a.initialPrice) ||
          Number(row.total_supply) !== Number(catalogue.totalSupply) ||
          Number(row.creator_split_percentage) !== 0))
    )
      throw Error(
        `Existing asset conflicts with catalogue: ${a.name}; no changes made`,
      );
  }
  return {
    existing: assets.length,
    create: catalogue.assets.length - assets.length,
    treasuryExists: accounts.length === 1,
  };
}

async function seedCatalogue(
  db,
  catalogue,
  { apply = false, ExchangeService, ResearchService } = {},
) {
  const plan = await preflight(db, catalogue);
  if (!apply)
    return { mode: "dry-run", ...plan, total: catalogue.assets.length };
  // Serialize concurrent imports without holding up ordinary exchange commands.
  const guard = db.createQueryRunner();
  await guard.connect();
  let locked = false;
  try {
    const [lock] = await guard.query(
      "SELECT pg_try_advisory_lock(73190423) AS locked",
    );
    locked = lock.locked;
    if (!locked) throw Error("Another catalogue import is running");
    await preflight(db, catalogue);
    await db.manager.transaction(async (m) => {
      await m.query("SELECT pg_advisory_xact_lock(73190421)");
      const accounts = await m.query("SELECT id FROM users WHERE id=$1", [
        issuer.id,
      ]);
      if (!accounts.length) {
        // A sentinel hash cannot authenticate through bcrypt. No password/token is generated.
        await m.query(
          "INSERT INTO users(id,email,username,role,password_hash) VALUES($1,$2,$3,'admin','!')",
          [issuer.id, issuer.email, issuer.username],
        );
        await m.query("INSERT INTO wallets(user_id,balance) VALUES($1,0)", [
          issuer.id,
        ]);
        await m.query(
          "INSERT INTO exchange_ledger(user_id,reason,available_delta,reserved_delta) VALUES($1,'endowment',0,0)",
          [issuer.id],
        );
      }
    });
    const engine = new ExchangeService(db.manager);
    const research = new ResearchService(db.manager);
    let issued = 0;
    for (const a of catalogue.assets) {
      const id = stableId(a.key);
      await db.query(
        `INSERT INTO assets(id,name,description,status,submitted_by_user_id)
        VALUES($1,$2,$3,'pending',$4) ON CONFLICT(id) DO NOTHING`,
        [id, a.name, a.description, issuer.id],
      );
      const [asset] = await db.query("SELECT status FROM assets WHERE id=$1", [
        id,
      ]);
      if (asset.status === "pending") {
        await engine.issue(
          issuer.id,
          `issue:${id}`,
          id,
          a.initialPrice,
          catalogue.totalSupply,
          catalogue.creatorPercentage,
        );
        issued++;
      }
      const [template] = await db.query(
        "SELECT sector,subsector FROM research_templates WHERE id=$1",
        [id],
      );
      if (
        !template ||
        template.sector !== a.sector ||
        template.subsector !== a.subsector
      )
        await research.template(id, {
          sector: a.sector,
          subsector: a.subsector,
        });
    }
    const mismatches = await db.query(
      `SELECT a.name FROM assets a
      LEFT JOIN holding h ON h.asset_id=a.id WHERE a.id=ANY($1::uuid[])
      GROUP BY a.id HAVING COALESCE(sum(h.quantity+h.frozen_quantity),0) <> a.total_supply`,
      [catalogue.assets.map((a) => stableId(a.key))],
    );
    if (mismatches.length)
      throw Error("Post-import asset conservation check failed");
    return {
      mode: "applied",
      issued,
      alreadyIssued: catalogue.assets.length - issued,
      total: catalogue.assets.length,
    };
  } finally {
    if (locked) await guard.query("SELECT pg_advisory_unlock(73190423)");
    await guard.release();
  }
}

async function main() {
  const args = process.argv.slice(2);
  let dataPath = path.join(__dirname, "starter-assets.json");
  let servicePath = fs.existsSync(
    path.resolve("services/trading_service/package.json"),
  )
    ? path.resolve("services/trading_service")
    : process.cwd();
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") apply = true;
    else if (args[i] === "--data" && args[i + 1])
      dataPath = path.resolve(args[++i]);
    else if (args[i] === "--service-dir" && args[i + 1])
      servicePath = path.resolve(args[++i]);
    else throw Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  const catalogue = validate(JSON.parse(fs.readFileSync(dataPath, "utf8")));
  if (!process.env.DATABASE_URL)
    throw Error(
      "DATABASE_URL is required; run inside the trading container or use a disposable test database",
    );
  const serviceRequire = createRequire(path.join(servicePath, "package.json"));
  const { DataSource } = serviceRequire("typeorm");
  const { ExchangeService } = serviceRequire(
    "./dist/exchange/exchange.service",
  );
  const { ResearchService } = serviceRequire(
    "./dist/research/research.service",
  );
  const db = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
  });
  await db.initialize();
  try {
    console.log(
      JSON.stringify(
        await seedCatalogue(db, catalogue, {
          apply,
          ExchangeService,
          ResearchService,
        }),
      ),
    );
  } finally {
    await db.destroy();
  }
}

module.exports = { validate, stableId, issuer, preflight, seedCatalogue };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
