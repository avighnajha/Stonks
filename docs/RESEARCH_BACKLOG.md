# Research follow-up work

Implemented infrastructure and operating instructions are in
[RESEARCH_OPERATIONS.md](RESEARCH_OPERATIONS.md). Personal planning notes remain
outside the repository. Python strategies remain the owner's learning work.

## Decisions implemented

- Separate Python strategy/worker repository; one active run per worker initially.
- Real-time shared market; accelerated, deterministic event scheduling for research.
- Independent database, books, accounts and allocations for every run.
- Versioned asset snapshots, sector/subsector factors, private delayed/noisy observations.
- Personal experiments, immutable run configurations, seed repetition and basic sweeps.
- Result exports and baseline liquidity/price-discovery/P&L measurements.

## Next work

- Owner-written market makers, value/informed traders, liquidity/noise traders and
  execution agents. Calibrate activity, capital, inventory, risk and information.
- Choose populations and asset counts against measured spread, depth, volume and
  impact; establish stable baselines before adding complexity.
- A real-time bot adapter for the shared market. Controlled research strategies use
  callbacks and the engine bridge; they do not yet run against the live REST API.
- Dynamic entry/exit, changing participation and capital, richer liquidity regimes.
- Repeated-seed statistics, held-out scenarios, ablations and execution-risk measures.
- VPS capacity, monitoring, backups, retention and orphan-run cleanup procedures.
- A deployment manifest that pins both repository versions and runtime images.

## Later, by explicit design

Public sharing; untrusted uploaded code sandboxing; distributed workers; execution
latency models; configurable fees; shorting/margin; derivatives; external news.
There is no claim that simulated alpha transfers to real markets.
