# Research infrastructure implementation contract

Python strategies are owner-written. Infrastructure supplies controlled observations,
deterministic scheduling, isolated exchange state and personal experiment management.
This is engineering documentation; personal planning/learning documents stay outside Git.

## Milestones and verification

1. Inject economic time and IDs into the existing engine. Add regression tests before
   refactoring; retain all existing accounting/concurrency regressions.
2. Versioned manifests, catalogue snapshots, personal experiments and immutable queued
   runs. Enforce ownership, bounded inputs and idempotent submission.
3. Isolated database provisioning and a local engine adapter. Never reuse a live book,
   Redis channel or account for a run. One bounded worker initially, with durable claims.
4. Separate Python SDK/runner: stable event ordering, private observations, seeded world
   factors, explicit allocations and scripted test fixtures. No substantive trading strategy.
5. Personal research UI: design, run, cancel, inspect, export and compare paired seeds.
6. Integration regressions, resource-light local operation and deployment instructions.

## Boundaries

- Shared market uses wall time; simulations use integer milliseconds from a fixed epoch.
- Exchange matching/accounting remains a single implementation. A JSON-lines adapter
  allows the Python runner to call it without using browser/network arrival order.
- Per-run databases and restricted roles live on a dedicated research PostgreSQL server.
  Provisioner credentials are excluded from browser responses and strategy callback
  data. Installed Python runs in the trusted worker process, which has these
  credentials in its environment; this is not isolation from malicious strategies.
- Only operator-installed strategies are executable. This is not a sandbox for arbitrary
  uploaded Python. Controlled strategy context cannot guarantee isolation from malicious
  code in the same Python process; untrusted code hosting is deferred.
- Completed manifests capture catalogue, strategy/protocol versions, parameters and seeds.
  Reproducibility means equal ordered economic outcomes under the pinned runtime, not
  identical physical logs or independent cross-version numerical results.
- Public sharing, margin, derivatives, external news and distributed workers are deferred.
- Test fixture runs prove infrastructure, not realistic price formation. Real presets await
  the owner's strategy implementations and calibration.
