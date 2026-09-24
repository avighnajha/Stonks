# Deferred simulation and research decisions

The current milestone is exchange correctness and reliable human/bot access. Bot strategy implementation remains the owner's work in a separate repository.

See [Research Lab design and financial mathematics guide](RESEARCH_LAB_GUIDE.md) for the proposed public observatory, isolated experiments, repository responsibilities, population comparisons and learning programme. These are proposals, not implemented features or final decisions.

Discuss after the exchange foundation is verified:

- Where bots run: independent processes/containers, local versus hosted, resource budgets, deployment and shutdown.
- Live wall-clock trading versus deterministic accelerated experiments; how to control latency and randomness without changing exchange rules.
- Agent populations and distributions: market makers, informed/value traders, noise/liquidity traders, execution agents; capital, inventory, risk, horizon and information differences.
- Population size and activity rates: calibrate to measurable spread, depth, volume and impact rather than choosing a large count for appearance.
- Number and kinds of assets; issuance, cross-asset relationships, common factors and liquidity concentration.
- Dynamic regimes: agent entry/exit, changing capital and participation, liquidity shocks and news.
- News semantics: hidden fundamentals versus public/noisy signals, observation delays and information access.
- Reproducibility: run manifests, seeds, versions, event records, resets and independent scenario sets.
- Research questions, baselines, costs, out-of-sample scenarios, ablations and limitations on transferring simulated alpha to real markets.

Separate bot repository is the intended boundary. Exchange owns matching, validation, balances and participant-facing data; bots use the same authenticated contract as humans. Privileged simulator controls must not leak into ordinary market data.
