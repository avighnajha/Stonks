# Participant API v1

All paths are relative to the gateway. Register or log in using `/auth/register` or `/auth/login`, then send `Authorization: Bearer <token>`. `/auth/me` validates the current session. Tokens expire after one hour; log in again. There is no refresh-token contract. Logout removes the token on the client; it does not revoke already issued bearer tokens.

## Commands

`POST /trade/buy/:assetId` or `/trade/sell/:assetId`:

```json
{ "assetAmount": "10.0000", "price": "100.00", "type": "LIMIT" }
```

Supply `Idempotency-Key: <unique command ID>` for every order, cancellation and news injection. The same key/body replays the committed result. Changed body with a committed key returns 409. Validation failures do not commit a command. On timeout, disconnect or 5xx, retry with the original key and body; never assume the order failed. Browser clients retain uncertain commands across refreshes.

Prices have a 0.01 tick, quantities a 0.0001 lot, settlement cash precision 0.000001. Decimal strings are preferred. Price and quantity must be positive and each fit 12 total digits at their respective precision. Cash reservation uses price × quantity. No borrowing, shorting or fees are implemented.

LIMIT orders rest at price/time priority, where time is the engine sequence. Executions use the maker's price. MARKET orders are immediate-or-cancel with the submitted price as a **maximum buy or minimum sell protection price**. Their remainders never rest. Self orders are skipped. Price improvement releases unused cash immediately.

`DELETE /trade/order/:orderId` cancels a participant's open remainder. A repeated committed cancellation with the same key returns the saved result. A new cancellation command for a closed order returns 409. `remaining_quantity` retains the unfilled quantity after cancellation; filled quantity is initial minus remaining. Closed orders have zero reservations.

## Private state

- `GET /trade/account`: a consistent wallet and position snapshot, including available/reserved balances, average cost and realized P&L.
- `GET /trade/orders?before=<sequence>`: own orders newest first, 100 per page; use the final sequence as the next `before` cursor.
- `GET /trade/order/:orderId`: own order and fills. Other participants receive 404.
- `GET /trade/fills?after=<sequence>`: own executions ascending, up to 500 per page. Use the last sequence to continue. Counterparty identifiers are omitted.

Account equity includes available **and** reserved cash and holdings. Portfolio marks use last trade, falling back to listing price. These marks are not liquidation prices. Average cost is maintained to eight decimal places; realized P&L is rounded to six. Cash and asset conservation are independent of this reporting convention. Legacy opening balances are not a reconstructed historical P&L record.

## Market data and recovery

- Public: `/trade/markets`, `/trade/quote/:assetId`, `/trade/history/:assetId?days=7&timeframe=1h`.
- Authenticated: `/trade/book/:assetId` returns aggregated bids/asks (50 levels per side) and a global `cursor` from the same database snapshot.
- `/trade/feed-snapshot` returns the latest book/trade per asset and 50 recent news events with a consistent global cursor.
- `/trade/events?after=<cursor>` returns durable committed events in ascending order, up to 500, with `nextCursor` and `hasMore`.
- Socket.IO namespace `/market`, handshake `auth: {token}`, emits `exchange_event` using the same event envelope.

Event envelope: `{sequence, assetId, type, payload, timestamp}`. Sequence is a **decimal string**, not a JS number. Types are `trade`, `book`, `news`. Book payloads replace the displayed top levels. Public events contain no participant identities.

Recovery algorithm: connect/buffer socket notifications, fetch a snapshot, apply it, then drain REST events after its cursor until `hasMore` is false. Deduplicate by sequence. Sequence gaps are legal (rolled-back transactions consume IDs); they do not imply missing events. On reconnect, continue REST replay from the last applied cursor. Periodically reconcile even while connected: Redis Pub/Sub does not retain notifications. The browser treats WebSockets as wakeups and polls REST every two seconds, so Redis downtime does not stop recovery. Keep snapshots/cursors in one state update.

Delivery is at least once from the outbox and best effort from Redis to live sockets; durable REST replay is authoritative. Events are retained; retention limits and archival policy remain a future operational decision. Historical candles are bounded to 10,000 requested intervals; raw history returns the latest 1,000 trades in the requested period.

## Administration

Asset approval is an atomic, single issuance with a stable per-asset command key. It mints the creator/platform split and places the platform's initial sell order. Repeating approval cannot mint again. `POST /admin/inject-news` records `{assetId,headline,sentiment}` durably (sentiment integer 0–100), requiring an administrator and an idempotency key. News does not directly change prices.

Only the gateway is exposed by Compose. Wallet and portfolio mutation endpoints from the previous implementation have been removed. Do not use internal service credentials for bots; bots are ordinary authenticated participants.
