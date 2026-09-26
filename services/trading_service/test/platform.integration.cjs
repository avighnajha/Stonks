// Full HTTP contract test. Builds must exist for all six services.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const net = require('node:net');
const path = require('node:path');
const { Client } = require('pg');
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is required');
const schema = `platform_test_${randomUUID().replaceAll('-', '')}`;
const children = [],
  logs = {};
let client, base, workerEnv;
async function freePort() {
  const s = net.createServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}
async function waitFor(url, child, name) {
  for (let i = 0; i < 450; i++) {
    if (child.exitCode !== null)
      throw new Error(`${name} exited: ${logs[name]}`);
    try {
      await fetch(url, { signal: AbortSignal.timeout(500) });
      return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${name} failed to start: ${logs[name]}`);
}
before(async () => {
  client = new Client({ connectionString: url });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  const dbUrl = new URL(url);
  dbUrl.searchParams.set('options', `-c search_path=${schema}`);
  const names = [
    'trading_service',
    'user_service',
    'wallet_service',
    'portfolio_service',
    'marketplace_service',
    'api_gateway',
  ];
  const ports = {};
  for (const name of names) ports[name] = await freePort();
  const env = {
    ...process.env,
    DATABASE_URL: dbUrl.toString(),
    JWT_SECRET: randomUUID() + randomUUID(),
    INTERNAL_API_KEY: randomUUID(),
    RESEARCH_WORKER_KEY: randomUUID(),
    REDIS_URL: 'redis://127.0.0.1:1',
    NODE_ENV: 'test',
    USER_SERVICE_URL: `http://127.0.0.1:${ports.user_service}`,
    WALLET_SERVICE_URL: `http://127.0.0.1:${ports.wallet_service}`,
    PORTFOLIO_SERVICE_URL: `http://127.0.0.1:${ports.portfolio_service}`,
    MARKETPLACE_SERVICE_URL: `http://127.0.0.1:${ports.marketplace_service}`,
    TRADING_SERVICE_URL: `http://127.0.0.1:${ports.trading_service}`,
  };
  workerEnv={...env,RESEARCH_API_URL:`http://127.0.0.1:${ports.trading_service}`,STONKS_EXCHANGE_DIR:path.resolve(__dirname,'../../..'),RESEARCH_DATABASE_ADMIN_URL:url};
  for (const name of names) {
    logs[name] = '';
    const child = spawn(
      process.execPath,
      ['-e', "console.log('Starting service'); require('./dist/main.js')"],
      {
        cwd: path.resolve(__dirname, '../../', name),
        env: { ...env, PORT: String(ports[name]) },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    children.push(child);
    for (const pipe of [child.stdout, child.stderr])
      pipe.on('data', (chunk) => {
        logs[name] = (logs[name] + chunk).slice(-8000);
      });
    await waitFor(`http://127.0.0.1:${ports[name]}/`, child, name);
  }
  base = `http://127.0.0.1:${ports.api_gateway}`;
  await client.query(`SET search_path=${schema}`);
});
after(async () => {
  await Promise.all(
    children.map((child) => {
      if (child.exitCode !== null) return;
      const done = once(child, 'exit');
      child.kill();
      return done;
    }),
  );
  if (client) {
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  }
});
async function request(route, method = 'GET', body, token, key) {
  const res = await fetch(base + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return { status: res.status, data: await res.json() };
}
test(
  'registration, issuance, execution, account recovery and authorization through the gateway',
  { timeout: 120000 },
  async () => {
    const password = 'test-account-password-123';
    const a = await request('/auth/register', 'POST', {
      email: 'admin@example.test',
      username: 'admin',
      password,
    });
    assert.equal(a.status, 201, JSON.stringify(a));
    const b = await request('/auth/register', 'POST', {
      email: 'buyer@example.test',
      username: 'buyer',
      password,
    });
    assert.equal(b.status, 201, JSON.stringify(b));
    await client.query("UPDATE users SET role='admin' WHERE id=$1", [
      a.data.user.id,
    ]);
    const login = await request('/auth/login', 'POST', {
      email: 'admin@example.test',
      password,
    });
    assert.equal(login.status, 200);
    const admin = login.data.token,
      buyer = b.data.token;
    assert.equal(
      (await request('/auth/me', 'GET', undefined, buyer)).data.user.id,
      b.data.user.id,
    );
    assert.equal((await request('/trade/account')).status, 401);
    assert.equal(
      (await request('/assets/admin/all', 'GET', undefined, buyer)).status,
      403,
    );
    const submitted = await request(
      '/assets/submit',
      'POST',
      { name: 'Test Asset', description: 'A test instrument' },
      admin,
    );
    assert.equal(submitted.status, 201, JSON.stringify(submitted));
    const id = submitted.data.id;
    const issue = { initialPrice: 90, totalSupply: 100, creatorPercentage: 0 };
    const approved = await request(
      `/assets/${id}/approve`,
      'PATCH',
      issue,
      admin,
    );
    assert.equal(approved.status, 200, JSON.stringify(approved) + logs.trading_service);
    assert.equal(
      (await request(`/assets/${id}/approve`, 'PATCH', issue, admin)).status,
      200,
    );
    const key = randomUUID(),
      order = { assetAmount: '10', price: '100', type: 'LIMIT' };
    assert.equal(
      (await request(`/trade/buy/${id}`, 'POST', order, buyer)).status,
      400,
    );
    const bought = await request(`/trade/buy/${id}`, 'POST', order, buyer, key);
    assert.equal(bought.status, 201, JSON.stringify(bought));
    assert.deepEqual(
      (await request(`/trade/buy/${id}`, 'POST', order, buyer, key)).data,
      bought.data,
    );
    const account = await request('/trade/account', 'GET', undefined, buyer);
    assert.equal(account.data.wallet.balance, '9100.000000');
    assert.equal(account.data.wallet.frozen_balance, '0.000000');
    assert.equal(account.data.positions[0].averageBuyPrice, '90.00000000');
    const mine = await request('/trade/orders', 'GET', undefined, buyer);
    assert.equal(mine.data.length, 1);
    assert.equal(
      (
        await request(
          `/trade/order/${bought.data.orderId}`,
          'GET',
          undefined,
          admin,
        )
      ).status,
      404,
    );
    const fills = await request('/trade/fills', 'GET', undefined, buyer);
    assert.equal(fills.data.length, 1);
    assert.ok(!('seller_id' in fills.data[0]));
    const history = await request(`/trade/history/${id}?days=1&timeframe=5m`);
    assert.equal(history.status, 200, JSON.stringify(history));
    assert.equal(Number(history.data[0].close), 90);
    const markets = await request('/trade/markets');
    assert.equal(markets.status, 200);
    assert.equal(Number(markets.data[0].price), 90);
    const book = await request(`/trade/book/${id}`, 'GET', undefined, buyer);
    assert.equal(book.status, 200);
    assert.ok(!JSON.stringify(book.data).includes(a.data.user.id));
    const newsKey = randomUUID(),
      news = { assetId: id, headline: 'Test news', sentiment: 60 };
    assert.equal(
      (await request('/admin/inject-news', 'POST', news, buyer, newsKey))
        .status,
      403,
    );
    assert.equal(
      (await request('/admin/inject-news', 'POST', news, admin, newsKey))
        .status,
      201,
    );
    const recovered = await request(
      `/trade/events?after=${book.data.cursor}`,
      'GET',
      undefined,
      buyer,
    );
    assert.deepEqual(
      recovered.data.events.map((e) => e.type),
      ['news'],
    ); // works with Redis deliberately offline
    const snapshot = await request(
      '/trade/feed-snapshot',
      'GET',
      undefined,
      buyer,
    );
    assert.equal(snapshot.status, 200);
    const leaderboard = await request(
      '/admin/leaderboard',
      'GET',
      undefined,
      admin,
    );
    assert.equal(leaderboard.status, 200, JSON.stringify(leaderboard));
    assert.equal(
      Number(
        leaderboard.data.find((u) => u.userId === b.data.user.id).netWorth,
      ),
      10000,
    );
    assert.equal(
      (
        await request(
          '/wallet/credit',
          'POST',
          { userId: b.data.user.id, amount: 999 },
          buyer,
        )
      ).status,
      404,
    );
    const manifest={version:1,durationMs:2000,stepMs:1000,seed:42,assets:[{id:'a',name:'A',sector:'Sports',subsector:'Football',price:'100.00',marketWeight:0,sectorWeight:0,subsectorWeight:0,idiosyncraticWeight:0}],groups:[{id:'g',strategy:'idle',count:1,cash:'1000',inventory:'10',wakeMs:1000,delayMs:0,signalNoise:0,parameters:{}}],events:[]};
    assert.equal((await request('/research/experiments')).status,401);
    const exp=await request('/research/experiments','POST',{title:'Research',hypothesis:'Test',manifest},buyer);
    assert.equal(exp.status,201,JSON.stringify(exp));
    const launch=await request(`/research/experiments/${exp.data.id}/runs`,'POST',{},buyer,'research-key');
    assert.equal(launch.status,201,JSON.stringify(launch));
    assert.equal((await request(`/research/runs/${launch.data.id}`,'GET',undefined,admin)).status,404);
    assert.equal((await request(`/research/runs/${launch.data.id}`,'GET',undefined,buyer)).data.status,'QUEUED');
    assert.equal((await request(`/research/runs/${launch.data.id}/cancel`,'POST',{},buyer)).data.status,'CANCELLED');
    assert.notEqual((await request('/research-worker/claim','POST',{},buyer)).status,201);
    if(process.env.SIMULATION_REPO&&process.env.PYTHON_BINARY){
      const live=await request(`/research/experiments/${exp.data.id}/runs`,'POST',{},buyer,'worker-run');
      const worker=spawn(process.env.PYTHON_BINARY,['-m','stonks_sim.worker','--once'],{cwd:process.env.SIMULATION_REPO,env:workerEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});
      let output='';worker.stdout.on('data',x=>output+=x);worker.stderr.on('data',x=>output+=x);children.push(worker);
      const [code]=await once(worker,'exit');assert.equal(code,0,output);
      const completed=await request(`/research/runs/${live.data.id}`,'GET',undefined,buyer);
      assert.equal(completed.data.status,'COMPLETED',JSON.stringify(completed));assert.ok(completed.data.result.economicHash);
    }
  },
);
