# Stonks — Project Full Context

This document provides a consolidated, developer-oriented map of the Stonks repository: architecture, services, endpoints, data models, and key functions/behaviors found in the codebase as of this snapshot. Use this as a single-file context summary to feed to a planning or design model.

---

**Project Overview:**
- **Purpose:** Social investment platform where people/assets are tradable instruments. Evolving toward a Central Limit Order Book and admin "Mission Control" dashboard; currently supports an AMM-style liquidity pool trading model plus microservices for users, wallets, marketplace (assets), trading, and portfolio.
- **Tech stack:** NestJS microservices (backend), React + Vite + Tailwind + shadcn/ui (frontend), PostgreSQL + TypeORM (DB), Docker Compose for local orchestration.

---

**Top-level layout (important paths)**
- `docker-compose.yml` — local multi-container orchestration (Postgres, api gateway, and microservices).
- `package.json` — root manifest.
- `docs/` — design notes and roadmaps: `project_context.txt`, `BACKEND_STRUCTURE.md`, `ORDER_BOOK_PLAN.md`, etc.
- `frontend/` — React app with pages, components, API helpers, and shadcn UI components.
- `services/` — microservices: `api_gateway`, `user_service`, `wallet_service`, `marketplace_service`, `trading_service`, `portfolio_service`. Each is a NestJS app with TypeORM entities.

---

**Global design notes (from docs/project_context.txt)**
- API Gateway is the central router; it proxies requests to internal services and enforces JWT auth via Passport.
- Services communicate via HTTP within Docker network (e.g., `http://wallet_service:3002/...`). They use `x-internal-api-key` headers for internal RPC authorization.
- Trading currently implemented via AMM (Constant Product x*y=k) — a plan exists to pivot to a CLOB with an order book and matching engine.
- Frontend uses `axios` instance to call the API Gateway at `VITE_API_URL` (defaults to `http://localhost:8080`). JWT stored in `localStorage`.

---

**Environment / runtime variables (observed usage)**
- `JWT_SECRET` — used by services' JWT strategies.
- `INTERNAL_API_KEY` — required by inter-service HTTP calls.
- `USER_SERVICE_URL`, `WALLET_SERVICE_URL`, `MARKETPLACE_SERVICE_URL`, `TRADING_SERVICE_URL`, `PORTFOLIO_SERVICE_URL` — used by API Gateway to route requests.
- `VITE_API_URL` — frontend base URL.

---

Service-by-service summary (key files & behaviors)

- **API Gateway (`services/api_gateway`)**
  - Purpose: Single public entry point (port 8080). Proxies authenticated and public requests to the appropriate internal service.
  - Important files:
    - `src/proxy/proxy.controller.ts` — `@All('*')` catch-all proxy. Uses `AuthGuard('jwt')` to protect proxied endpoints. Forwards requests (method, path, headers, body) to a determined recipient service URL via `getRecipientServiceUrl()` which maps URL prefixes to env variables. Returns proxied response or error.
    - `src/public/public.controller.ts` — handles `POST /auth/register`, `POST /auth/login`, and public `GET /assets` routes; proxies them to user/marketplace service without JWT guard.
    - `src/auth/jwt.strategy.ts` — Passport JWT strategy for token extraction and validation (reads JWT secret). `validate` returns `{ userId, email, role }`.
    - `src/app.module.ts` — registers `HttpModule`, `PassportModule`, `ConfigModule` and wires `JwtStrategy`.
  - Notes: Authorization is enforced at gateway for proxied routes. Proxy forwards `Authorization` header to services.

- **User Service (`services/user_service`)**
  - Purpose: User registration and authentication. Creates user entries and issues JWTs.
  - Important files:
    - `src/user/entities/user.entity.ts` — TypeORM `User` entity: `id, email, username, role, password_hash, created_at, updated_at`.
    - `src/user/user.service.ts` — core logic: `create()` registers user (hashes password with bcrypt), calls wallet service to create a wallet for new user via internal HTTP request, and returns a JWT token and user object. `login()` verifies password and returns a JWT + user info.
    - `src/user/user.controller.ts` — exposes `POST /auth/register` and `POST /auth/login` routes.
  - Notes: On user create, service posts to `http://wallet_service:3002/wallet` with `x-internal-api-key` header to create a wallet; this is done asynchronously but wrapped in try/catch.

- **Wallet Service (`services/wallet_service`)**
  - Purpose: Manage user balances, frozen balances (for reserved funds), wallet creation, debit/credit operations.
  - Important files:
    - `src/wallet/entities/wallet.entity.ts` — `id, user_id(uuid), balance(decimal), frozen_balance(decimal), created_at, updated_at`.
    - `src/wallet/wallet.service.ts` — `createWallet(userId)` (starts with balance 10000), `getWallet(userId)`, `changeBalance(userId, amount, debit)` (debit/credit), `freezeFunds` / `unfreezeFunds`.
    - `src/main.ts`, controller files — expose endpoints for debit/credit and wallet retrieval (not all controllers shown in index but present in codebase).
  - Notes: Many calls to wallet endpoints originate from trading and user services; inter-service auth uses `x-internal-api-key`.

- **Marketplace Service (`services/marketplace_service`)**
  - Purpose: Asset lifecycle (submission → approval → creates liquidity pool). Holds Asset entities and accepts public queries for assets.
  - Important files:
    - `src/asset/entities/asset.entity.ts` — `id, name, description, imageUrl, status (approved/pending/rejected), submitted_by_user_id, created_at, updated_at`.
    - `src/asset/asset.service.ts` — `getAllAssets()`, `getApprovedAssets()`, `findOne(assetId)`, `submit(assetDto, userId)`, `approve(assetId)` — when approving, calls trading service to `POST /trade/create-pool`.
    - `src/asset/asset.controller.ts` — exposes `GET /assets`, `GET /assets/:id`, `POST /assets`, admin endpoints for approving assets.

- **Trading Service (`services/trading_service`)**
  - Purpose: Market mechanics. Currently an AMM liquidity pool model plus price history. Contains buy/sell execution with wallet and portfolio coordination.
  - Important files & logic:
    - `src/trade/entities/liquidity_pool.entity.ts` — liquidity pools: `id, asset_id, asset_balance, currency_balance, k getter`.
    - `src/trade/entities/price-history.entity.ts` — price history points: `asset_id, price, timestamp`.
    - `src/trade/trade.service.ts` — key functions:
       - `createPool(assetId)` — initializes pool with default balances.
       - `getQuote(assetId)` — returns current price = `currency_balance / asset_balance`.
       - `executeBuy(assetId, userId, stockAmount)` — wrapped in DB transaction: locks pool row (pessimistic write), computes cost using constant product AMM math (k = x*y), debits user wallet (`wallet_service:3002/wallet/debit`) via internal HTTP, updates portfolio (`portfolio_service:3005/portfolio/update`) via HTTP patch, updates pool balances, writes price history.
       - `executeSell(assetId, userId, stockAmount)` — similar flow: updates portfolio first (remove holding), credit wallet, update pool, write price history. Uses transactional entity manager and performs compensating calls on failure.
       - `getPrices(assetIds)` — batch price lookup for front-facing portfolio calculations.
    - Controllers expose endpoints like `/trade/buy`, `/trade/sell`, `/trade/create-pool`, `/trade/prices`.
  - Notes: The AMM logic uses pessimistic locking and transactional entity manager to provide atomicity. The service depends on wallet and portfolio microservices and expects rollback/compensating behavior when those fail.

- **Portfolio Service (`services/portfolio_service`)**
  - Purpose: Track user holdings; compute portfolio values using current prices from trading service.
  - Important files:
    - `src/holding/entities/holding.entity.ts` — `id, user_id, asset_id, quantity, frozen_quantity, average_buy_price`.
    - `src/holding/holding.service.ts` — `getPortfolio(userId)` fetches holdings and asks trading service for prices, returns computed values; `updateHoldings(userId, assetId, quantityChange, tradePrice)` handles buy/sell logic (create holding, update quantity/avg price, delete when zero); `freezeHoldings`/`unfreezeHoldings` to support orders.
    - Controller exposes `GET /portfolio/:userId` and `PATCH /portfolio/update` used by trading service.

- **Frontend (`frontend/`)**
  - Purpose: User-facing SPA with pages: Index/hub, Explore, Portfolio, Trending, StockDetail, NotFound.
  - Important files:
    - `src/api/axiosInstance.ts` — axios instance with `baseURL` from `VITE_API_URL` and interceptors to attach JWT from `localStorage`. Handles 401 to clear tokens.
    - `src/api/auth.api.ts` — `registerUser`, `loginUser`, `logoutUser` wrappers that call `/auth/*` endpoints and manage `localStorage` tokens.
    - `src/App.tsx` — main router, wraps with `AuthProvider`, `QueryClientProvider`, and global UI providers.
    - `src/pages/Index.tsx` — tab-based hub switching between `Explore`, `Portfolio`, `Trending`, and a `StockDetail` overlay view.
    - `src/pages/*` — several page components: `Explore`, `Portfolio`, `Trending`, `StockDetail`, `NotFound`.
    - `src/components/*` — `Layout.tsx`, `StockCard.tsx`, `ProtectedRoute.tsx`, `LoginModal.tsx`, `ProfileModal.tsx`, and a large collection of shadcn/ui derived components in `components/ui/` (buttons, inputs, table, charts, toasts, etc.).
  - Notes: Frontend currently renders data from API Gateway; many UI building blocks are provided (table, chart, toast, carousel). `Index` uses simple internal state for active tab and selected stock.

---

Key endpoints (how to reach functionality)
- Public (via API Gateway)
  - `POST /auth/register` -> proxied to user service register
  - `POST /auth/login` -> proxied to user service login
  - `GET /assets` and `GET /assets/:id` -> marketplace
- Protected (gateway enforces JWT)
  - `/wallet/*` -> wallet service endpoints (create, debit, credit, get)
  - `/portfolio/*` -> portfolio endpoints
  - `/trade/*` -> trading endpoints (create-pool, buy, sell, prices)

---

Notable functions and code paths (detailed)
- `ProxyController.proxyRequest()` (api_gateway): catch-all that resolves recipient based on URL prefix and forwards method, headers (`Authorization`), and body using `HttpService`. Returns proxied response or error.
- `UserService.create()` (user_service): hashes password, saves user, posts to wallet service to create a wallet, issues JWT via `JwtService.sign` and returns user object and token.
- `WalletService.changeBalance()` (wallet_service): debits or credits wallet; validates insufficient funds for debit, writes back to DB. Also provides `freezeFunds` / `unfreezeFunds` for reserving funds.
- `TradeService.executeBuy()` (trading_service): transactional flow that locks pool row, computes AMM cost using constant product formula, debits wallet via HTTP, updates portfolio via HTTP patch, updates pool balances, saves price history; compensates on failures (credits wallet back if portfolio update fails).
- `HoldingService.updateHoldings()` (portfolio_service): creates holding if none; on buy recalculates average buy price; on sell prevents negative holdings and deletes holding if quantity reaches zero.

---

Database schema summary (entities & fields)
- Users (user_service.User): `id(uuid), email, username, role, password_hash, created_at, updated_at`.
- Wallets (wallet_service.Wallet): `id, user_id(uuid), balance(decimal), frozen_balance(decimal), created_at, updated_at`.
- Assets (marketplace_service.Asset): `id, name, description, imageUrl, status, submitted_by_user_id, created_at, updated_at`.
- LiquidityPool (trading_service.LiquidityPool): `id, asset_id, asset_balance(decimal), currency_balance(decimal)` + computed `k`.
- PriceHistory (trading_service.PriceHistory): `id, asset_id, price, timestamp`.
- Holding (portfolio_service.Holding): `id, user_id, asset_id, quantity(decimal), frozen_quantity(decimal), average_buy_price(decimal)`.

---

Limitations & known gaps (from docs + code observation)
- Order Book: Not yet implemented — trading uses AMM pools; roadmap shows intent to add CLOB and matching engine.
- Real-time: No WebSockets/socket.io currently; plans exist to add socket gateway in API Gateway to push updates.
- Atomic cross-service transactions: Services use HTTP and transactions within a service. Distributed transaction safety relies on optimistic compensating actions; a saga pattern or message queue would be safer for atomic multi-service actions.
- Admin/God mode and role-based admin routes: Not implemented yet; user roles exist but not enforced for admin-only UI.
- Tests: Some e2e test stubs exist, but no comprehensive integration tests of full multi-service flows visible.

---

How to use this document
- This file is a snapshot summary. If you want a deeper per-file function listing (every exported function, argument types, and a short docstring), I can run a targeted pass that reads every file and extracts exports and function signatures into a machine-readable JSON or Markdown outline.

Next suggested actions (I can do these for you):
- (A) Produce a fully machine-readable JSON index of every file, exported symbols, and first-line doc comments.
- (B) Add OpenAPI-style route documentation for all controllers found in the services.
- (C) Create a dependency graph (service → service calls) and a sequence diagram for a trade (buy+sell flows).

If you want option (A)/(B)/(C), tell me which and I will run the extraction and write artifacts into the repo.

---

Generated on: 2026-05-25
