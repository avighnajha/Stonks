# Stonks

A simulated limit-order-book exchange for human participants and independently operated trading bots. The long-term aim is a reproducible market-microstructure research environment. Assets can represent people, ideas or conventional fictional instruments; all balances are simulation units.

The exchange owns validation, price/time matching, reservations, atomic settlement and an append-only application ledger. PostgreSQL is authoritative. Redis and Socket.IO distribute committed events, with durable REST replay for reconnects. React provides market data, order entry, cancellations, fills, account positions and administration.

## Run

Use Node 22. Copy `.env.example` to `.env`, configure the secrets, then run `docker compose up --build`. Run `npm ci` and `npm run dev` in `frontend`. The gateway is available at `http://localhost:8080`, and Vite proxies requests to it.

**Existing databases:** read [the upgrade procedure](docs/EXCHANGE_OPERATIONS.md) before starting the new services. The migration refuses unresolved legacy orders/reservations rather than silently changing balances. Back up first and stop all old services and compensation workers. Do not mix old/new accounting code.

## Contracts and evidence

- [Participant API and recovery protocol](docs/PARTICIPANT_API.md)
- [Accounting, operations and tests](docs/EXCHANGE_OPERATIONS.md)
- [Deferred bot/simulation/research decisions](docs/RESEARCH_BACKLOG.md)

Build the six services, set `TEST_DATABASE_URL` to a disposable PostgreSQL instance, and run `npm run test:integration` in `services/trading_service`. Tests create isolated schemas and cover concurrency, conservation, rollback, idempotency and the full HTTP flow. CI also checks service builds, unit tests and frontend types.

Current scope is cash-backed spot trading, limit orders and protected immediate-or-cancel market orders. No margin, shorting, fees, auctions or deterministic bot scheduler are claimed. A global transaction sequencer favors correctness; throughput limits must be benchmarked before large bot runs. Historical project notes in `docs/PROJECT_CONTEXT_FULL.md` describe earlier versions and are not the current API contract.
