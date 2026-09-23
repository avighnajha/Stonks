# Exchange operating contract

## Upgrade

Back up PostgreSQL and stop **all** old application processes and compensation workers before deploying this version. Trading service owns schema migrations; automatic TypeORM synchronization is disabled in every service. Never run old and new settlement code against the same database.

For an existing simulation, reconcile or cancel legacy open orders first. The migration refuses databases with open orders, frozen balances, duplicates or invalid balances; it does not guess which historical transfers succeeded. Restore and inspect a copy of the backup when reconciling. An opening ledger preserves the accepted legacy balances, but does not certify historical P&L. A fresh simulation database is preferable for research. Do not delete a database to bypass this check without explicitly deciding to discard that simulation.

## Matching and accounting

One PostgreSQL transaction owns order admission, reservations, fills, accounting, ledger entries and durable events. A transaction-scoped global advisory lock gives all mutation commands a total order, including different assets sharing accounts. This deliberately prioritizes correctness over throughput; measure contention before partitioning the engine.

Prices have two decimal places, quantities four, and settlement cash six. Clients may send decimal strings. Unsupported precision is rejected, never rounded silently. LIMIT orders use price then engine sequence priority and execute at the resting order's price. MARKET orders are immediate-or-cancel; their required price is a protection bound (maximum buy/minimum sell). Self orders are skipped. Unfilled LIMIT quantities rest; MARKET remainders release their reservations. Price improvement is returned immediately.

Supply issuance is an explicit atomic operation. Normal participants cannot credit wallets, mint holdings or invoke settlement. New accounts receive the documented simulation endowment. Cash/asset ledger changes distinguish issuance/endowment from transfers.

Mutation clients must supply an Idempotency-Key, unique per logical command. Retry uncertain responses with the **same** key and identical body; do not create a new key until the outcome is known. Reusing a key with a different request is a conflict. Keys and outcomes remain durable.

## Deferred work

See RESEARCH_BACKLOG.md for agent populations, runtime, deterministic simulated time, scenario design and research evaluation. Live exchange command sequencing provides replayable evidence; it is not itself a deterministic bot scheduler.

## Running and testing

Use Node 22. Copy `.env.example` to `.env`, set both secrets, and run `docker compose up --build`. Compose builds reproducibly with `npm ci`, runs compiled services, waits for the trading schema owner before starting dependants, and exposes only the gateway on loopback port 8080. Database major version remains PostgreSQL 14 for compatibility with existing volumes. Redis persistence is enabled; PostgreSQL remains the authority even if Redis is unavailable. Do not start multiple trading replicas while applying a migration.

Run the frontend separately with `cd frontend`, `npm ci`, `npm run dev`. The Vite proxy routes same-origin HTTP and Socket.IO to the gateway. For a hosted frontend, configure its gateway URL or an equivalent reverse proxy. Compose is a local deployment baseline; it does not configure public TLS or a hosted frontend.

Build all six services before the integration suite. In `services/trading_service`, set `TEST_DATABASE_URL` to a disposable PostgreSQL instance, then run `npm run build`, `npm test -- --runInBand` and `npm run test:integration`. Tests create unique schemas and remove only those schemas. The HTTP suite starts all six compiled services on ephemeral loopback ports and stops its child processes afterward. It intentionally runs with Redis offline to verify durable recovery. No test uses the application database implicitly.

CI repeats builds, unit tests, PostgreSQL regressions, full-stack HTTP tests and frontend type checking. The tests cover conservation, reservations, concurrency, priority, fractional settlement, idempotency, rollback, restart, issuance and participant isolation. The global sequencer's throughput and public-internet deployment hardening should be measured separately before a large bot rollout.
