# Running the research infrastructure

The Research tab is personal and authenticated. Shared-market balances and run balances
are independent. Strategies live in the separate private repository
[stonks-simulation](https://github.com/avighnajha/stonks-simulation).

## What is implemented

- Private saved experiments; validated, immutable run manifests; seed repetition.
- Optional UI parameter sweeps saved as separate named experiments; active-run quota.
- Queued/running/completed/failed/cancelled states, worker leases and owner cancellation.
- Catalogue sector/subsector classification with versioned run snapshots; private assets.
- Independent database and restricted login per run, using the existing exchange engine.
- Logical milliseconds, deterministic order/trade IDs, factor worlds and delayed observations.
- Python strategy SDK, test fixtures, decision logs, accounting conservation checks.
- Price/reference charts, final books/fills, cohort marked P&L, spread/missing-book/RMSE
  measurements, run comparison and JSON exports.

`idle` and `scripted` are infrastructure fixtures. They do not supply a realistic market.
The owner implements actual market makers, value/momentum and execution strategies.
There is no public gallery, arbitrary uploaded code execution, margin or derivatives.
Fees remain zero in this version. Complex execution-risk metrics require appropriate
strategy contracts; existing measurements state their sample and mark conventions.

## Low-memory local testing

The Python worker has no third-party Python dependencies and processes one run at a
time. Build only the trading service to run standalone manifests; the six HTTP services
are only needed to exercise the website's full login/market/queue workflow.

1. Clone `stonks-simulation` beside `Stonks`.
2. In `services/trading_service`, run `npm ci` and `npm run build` with Node 22.
3. Start a disposable PostgreSQL 14+ server specifically for research. Give its
   provisioner CREATEDB and CREATEROLE. Never share its administrator credential with
   the application frontend or untrusted strategy code.
4. In the simulation checkout set:

```powershell
$env:STONKS_EXCHANGE_DIR='C:\path\to\Stonks'
$env:RESEARCH_DATABASE_ADMIN_URL='postgresql://provisioner:password@127.0.0.1:5432/postgres'
python -m stonks_sim.worker --manifest examples/smoke.json --output result.json
```

For the queue, configure a random `RESEARCH_WORKER_KEY` on both trading service and worker.
Set `RESEARCH_API_URL` to the internal trading-service URL, not the public gateway. Run
`python -m stonks_sim.worker`. The gateway deliberately does not route `/research-worker`.
Use TLS/private networking when the worker is on another host. Do not expose the trading
service or database publicly. Set `RESEARCH_STRATEGIES` on both the exchange and worker
to the operator-registered strategy names; configure `STONKS_STRATEGY_REGISTRY` as
described in the Python README.

## Optional Docker deployment

The existing six services remain the live platform. The research overlay adds a separate
small PostgreSQL server and one worker. Docker Compose must support additional build
contexts. Set `RESEARCH_WORKER_KEY` and `RESEARCH_DB_PASSWORD` in `.env`, then:

```sh
docker compose -f docker-compose.yml -f docker-compose.research.yml up --build
```

Use URL-safe passwords or URL-encode them when constructing database URLs. The worker
image bundles Python and the compiled engine; no GitHub credentials are needed inside
the image. Keep the simulation checkout free of secrets (its `.dockerignore` excludes
local environments/results). Do not increase worker count before measuring memory,
connections and throughput. The frontend still runs separately or behind your chosen
static host/reverse proxy. Container execution must be verified on the deployment host;
local validation used native PostgreSQL because Docker was unavailable.

## Failure and cleanup

Worker leases last 90 seconds and are renewed every 10. Losing a lease fails the run;
retry by cloning/relaunching its manifest. Queued cancellation is immediate; a running
worker checks cancellation between events. In-process strategies are trusted code and
must return promptly; they are not an OS-level sandbox for hostile/infinite-loop code.
Ordinary runs have explicit command/event/time budgets. A malicious or hanging Python
callback is outside this isolation model and requires process supervision.

Run databases are exported and dropped on normal completion or handled failure. A hard
kill can leave an orphan database. Confirm the run is inactive, then run the operator
command with its exact generated name:

```sh
node services/trading_service/dist/research/provision.js drop stonks_run_<run UUID without hyphens>
```

Never bulk-drop by a guessed pattern. Worker credentials and lease tokens are not in
participant responses. Result retention is currently persistent; production retention
quotas/archival need operational configuration before open public signup at scale.

## Verification

In trading service, with `TEST_DATABASE_URL` pointing to a disposable test server:

```sh
npm run build
npm test -- --runInBand
npm run test:integration
```

To include the actual queue-to-Python-worker HTTP regression, additionally set
`SIMULATION_REPO` and `PYTHON_BINARY` (absolute paths). The test starts the six services
on ephemeral loopback ports, provisions only generated run databases and cleans them up.

In the Python repository, set the exchange path and research database URL, then run
`python -m unittest discover -s tests -v`. Without database settings only pure runtime/SDK
tests run; database integration tests explicitly report skipped. Integration verifies
repeatable economic hashes, actual settlement and isolation across simultaneous books.

The controlled adapter exports logical-time trades directly; live `/trade/history` is
not used for simulation analytics because its rolling windows follow the live clock.
Floating-point world/metric arithmetic is reproducible only under compatible pinned
Python/code versions. Settlement remains exact decimal arithmetic.
