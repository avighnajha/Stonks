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

## Proposed agent asset scope

Design proposal from the asset-focus discussion; these UI/SDK controls are not
implemented yet.

- An agent represents an independent account with one shared cash pool and a
  portfolio. Strategies can manage 1-N selected experiment assets. A single-asset
  specialist is a configuration of this model, not a separate agent architecture.
- Each group should select all experiment assets or an explicit subset. Initially,
  every agent in a group receives that same universe; separate groups can represent
  specialists. Automatic distribution of individual agents among assets is deferred.
- Apply asset scope to every strategy flavour. The runner/adapter should reject
  orders outside the configured universe. Permission to trade an asset does not
  require a strategy to quote or trade it continuously.
- Keep trading scope separate from observation access. Proposed SDK field
  `context.tradable_assets` maps allowed run labels to public asset metadata;
  `context.assets` retains visible experiment metadata. Keep the full account
  visible for portfolio risk. The proposed field does not exist in the current SDK.
- Add explicit per-asset inventory allocations and risk limits. The current uniform
  inventory endowment covers every run asset, even if a strategy ignores it.
- Compare independent specialists with multi-asset dealers using controlled total
  cash and initial inventory. Shared capital and portfolio risk can transmit shocks
  between assets; these are experimental mechanisms to study. Independent agents
  do not share a budget merely because they run the same strategy code.

## Later, by explicit design

Public sharing; untrusted uploaded code sandboxing; distributed workers; execution
latency models; configurable fees; shorting/margin; derivatives; external news.
There is no claim that simulated alpha transfers to real markets.
