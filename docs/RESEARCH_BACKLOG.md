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
- Group trading universes, typed SDK context, scope enforcement and inventory
  endowments limited to each group's tradable assets. Omitted scopes mean all assets.

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

## Agent asset scope and follow-up design

The group asset selector, manifest pipeline, SDK field and runner/adapter checks
are implemented. Remaining extensions are identified below.

- An agent represents an independent account with one shared cash pool and a
  portfolio. Strategies can manage 1-N selected experiment assets. A single-asset
  specialist is a configuration of this model, not a separate agent architecture.
- Each group selects all experiment assets or an explicit subset. Initially,
  every agent in a group receives that same universe; separate groups can represent
  specialists. Automatic distribution of individual agents among assets is deferred.
- Asset scope applies to every strategy flavour. The runner/adapter rejects
  orders outside the configured universe. Permission to trade an asset does not
  require a strategy to quote or trade it continuously.
- Trading scope is separate from observation access. SDK field
  `context.tradable_assets` maps allowed run labels to public asset metadata;
  `context.assets` retains visible experiment metadata. The full account remains
  visible for portfolio risk. Available in SDK 0.2.0 and later.
- Starting shares are uniform per tradable asset. Explicit per-asset inventory
  allocations and risk limits remain future work. Legacy manifests without a
  trading scope retain their original all-assets endowments.
- Compare independent specialists with multi-asset dealers using controlled total
  cash and initial inventory. Shared capital and portfolio risk can transmit shocks
  between assets; these are experimental mechanisms to study. Independent agents
  do not share a budget merely because they run the same strategy code.

## Later, by explicit design

Public sharing; untrusted uploaded code sandboxing; distributed workers; execution
latency models; configurable fees; shorting/margin; derivatives; external news.
There is no claim that simulated alpha transfers to real markets.

### User-owned bot implementations

Allow authenticated users to add and version their own Python bot implementations,
then select those private strategies in their research experiments. This is planned;
the current registry still accepts trusted operator-installed code only.

Design isolated execution before accepting uploads: separate processes/containers,
CPU/memory/time limits, controlled filesystem/network access, no exchange/database
secrets, user ownership checks and pinned code/dependency versions in run results.
SDK context filtering and trading-scope checks alone do not sandbox Python code.
Public strategy sharing can be considered separately later.
