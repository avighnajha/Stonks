# Silver terminal UI

Implemented across the shared exchange and personal research workspace:

- Neutral carbon surfaces and silver controls. Green/red communicate price movement, bids/asks and P&L.
- Desktop sidebar; mobile Research / Market / Portfolio bottom navigation. Operations and asset approvals stay admin-only.
- Market search and sorting by traded value, gainers, decliners or name. No invented activity, sectors or sparklines.
- Timestamped price chart, order book and protected market/limit order entry. Existing command idempotency is preserved.
- Portfolio capital summary, positions and order history.
- Personal research overview, four setup steps, existing repeated seeds/sweeps, run inspection, comparisons and exports.
- Operations uses the same shell. Nonfunctional pause/flush placeholders were removed; actual news and approval actions remain.

Chart-heavy workspaces are loaded on demand. The bundle path stays `/_static` to avoid the `/assets` API namespace.

## Verification

The research regression passed against the original UI before the layout refactor. It then passed with the new overview entry point. Market tests exercise search/sorting, candle timestamps, limit-order payloads and idempotency headers, cancellation, stale-data warnings, navigation out of asset details, retained setup input and mobile width.

```sh
cd frontend
npm ci
npm run build
npx tsc --noEmit -p tsconfig.app.json
npx playwright install chromium
npm run test:ui
```

`test:ui` starts a local production preview on port 5186 and mocks API responses. It does not submit orders or create research runs on the live exchange. Set `BROWSER_CHANNEL=msedge` to use installed Edge locally; `SCREENSHOT_DIR` optionally saves visual review images. CI installs Chromium and runs both browser scripts.

Future data features (sector-aware market filters, market sparklines, additional research measurements) should be backed by exchange APIs before appearing in the UI. Public research sharing remains deferred.
