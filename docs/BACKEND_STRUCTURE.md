# Stonks Backend - Microservices Architecture

## 📁 Overall Structure

```
services/
├── api_gateway/           # Entry point for all frontend requests (Port 8080)
├── user_service/          # User management & authentication (Port 3001)
├── wallet_service/        # User wallet & balance management (Port 3002)
├── marketplace_service/   # Asset listing & management (Port 3003)
├── trading_service/       # Trading engine with liquidity pools (Port 3004)
└── portfolio_service/     # User holdings & portfolio tracking (Port 3005)
```

---

## 🚪 API Gateway Service (`api_gateway/`)

**Purpose:** Single entry point for all frontend requests. Routes requests to appropriate microservices and handles public endpoints.

### Structure:
```
api_gateway/src/
├── main.ts                    # Service entry point, enables CORS
├── app.module.ts              # NestJS module setup with controllers & providers
├── app.controller.ts          # Basic health check endpoint
├── app.service.ts             # Core service logic
├── app.controller.spec.ts     # Unit tests for app controller
│
├── auth/
│   └── jwt.strategy.ts        # JWT validation strategy for Passport
│
├── proxy/
│   └── proxy.controller.ts    # Catch-all route that proxies requests to other services
│                              # Maps URL prefixes to microservice URLs:
│                              # /auth → user_service
│                              # /wallet → wallet_service
│                              # /assets → marketplace_service
│                              # /trade → trading_service
│                              # /portfolio → portfolio_service
│
└── public/
    └── public.controller.ts   # Handles public endpoints without JWT auth
                               # Routes: /auth/register, /auth/login
                               # Routes: /assets (read-only)
```

---

## 👤 User Service (`user_service/`)

**Purpose:** Manages user accounts, authentication (JWT), and user profile data.

### Structure:
```
user_service/src/
├── main.ts                    # Service entry point
├── app.module.ts              # Database setup, module imports
├── app.controller.ts          # Basic health check
├── app.service.ts             # Core service
├── logger.middleware.ts       # Request logging middleware
│
└── user/
    ├── user.controller.ts     # HTTP endpoints:
    │                           # POST /auth/register - Create new user
    │                           # POST /auth/login - Authenticate user
    │
    ├── user.service.ts        # Business logic:
    │                           # create(userDto) - Register user
    │                           # login(credentials) - Validate & return JWT
    │                           # Creates wallet on user registration
    │
    ├── entities/
    │   └── user.entity.ts      # User database model (username, email, password_hash)
    │
    └── dto/
        ├── create_user.dto.ts  # Validation for registration (email, username, password)
        └── login_user.dto.ts   # Validation for login (email, password)
```

---

## 💰 Wallet Service (`wallet_service/`)

**Purpose:** Manages user wallet balances, tracks debit/credit operations.

### Structure:
```
wallet_service/src/
├── main.ts                    # Service entry point
├── app.module.ts              # Database & module setup
├── app.controller.ts          # Basic health check
├── app.service.ts             # Core service
│
├── auth/
│   ├── jwt.strategy.ts        # JWT validation
│   └── api_key.guard.ts       # Internal API key validation for service-to-service calls
│
└── wallet/
    ├── wallet.controller.ts   # HTTP endpoints:
    │                           # POST /wallet - Create wallet (internal API)
    │                           # GET /wallet/balance - Get balance (requires auth)
    │                           # POST /wallet/debit - Deduct from balance
    │                           # POST /wallet/credit - Add to balance
    │
    ├── wallet.service.ts      # Business logic for wallet operations
    │
    └── entities/
        └── wallet.entity.ts   # Wallet database model (userId, balance)
```

---

## 🏪 Marketplace Service (`marketplace_service/`)

**Purpose:** Lists available assets, manages asset approval workflow.

### Structure:
```
marketplace_service/src/
├── main.ts                    # Service entry point
├── app.module.ts              # Database & module setup
├── app.controller.ts          # Basic health check
├── app.service.ts             # Core service
│
├── auth/
│   ├── jwt.strategy.ts        # JWT validation
│   ├── roles.guard.ts         # Role-based access control
│   ├── roles.decorator.ts     # Decorator to mark role-protected routes
│   └── user-role.enum.ts      # Role definitions (user, admin, etc)
│
└── asset/
    ├── asset.controller.ts    # HTTP endpoints:
    │                           # GET /assets - List all approved assets
    │                           # GET /assets/:id - Get asset details
    │                           # POST /assets - Submit asset for approval
    │                           # PUT /assets/:id/approve - Admin approve (requires admin role)
    │
    ├── asset.service.ts       # Business logic:
    │                           # getAllAssets() - Approved assets only
    │                           # submitAsset() - User submits new asset
    │                           # approveAsset() - Admin approves
    │
    ├── entities/
    │   ├── asset.entity.ts    # Asset database model (name, description, status)
    │   └── asset.dto.ts       # DTOs for request validation
    │
    └── asset.module.ts        # Module configuration
```

---

## 📈 Trading Service (`trading_service/`)

**Purpose:** Executes trades using Automated Market Maker (AMM) model with liquidity pools. Tracks price history.

### Structure:
```
trading_service/src/
├── main.ts                    # Service entry point
├── app.module.ts              # Database & module setup
├── app.controller.ts          # Basic health check
├── app.service.ts             # Core service
│
├── auth/
│   ├── jwt.strategy.ts        # JWT validation
│   ├── roles.guard.ts         # Role-based access control
│   ├── roles.decorator.ts     # Decorator for role protection
│   ├── user-role.enum.ts      # Role definitions
│   └── api_key.guard.ts       # Internal API key for service-to-service
│
└── trade/
    ├── trade.controller.ts    # HTTP endpoints:
    │                           # GET /trade/quote/:assetId - Get current price
    │                           # GET /trade/history/:assetId - Price history
    │                           # POST /trade/buy/:assetId - Buy asset
    │                           # POST /trade/sell/:assetId - Sell asset
    │                           # POST /trade/pool - Create liquidity pool (admin)
    │
    ├── trade.service.ts       # Business logic:
    │                           # getQuote() - Current price from pool
    │                           # buyAsset() - Execute buy, update pool
    │                           # sellAsset() - Execute sell, update pool
    │                           # Uses Constant Product Formula: k = x*y
    │
    ├── entities/
    │   ├── liquidity_pool.entity.ts  # Liquidity pool model
    │   │                              # (assetId, reserveAsset, reserveUSDC, k)
    │   └── price_history.entity.ts   # Price history tracking
    │                                 # (assetId, price, timestamp)
    │
    ├── dto/
    │   └── trade.dto.ts       # DTOs for trade requests
    │
    └── trade.module.ts        # Module configuration
```

---

## 👝 Portfolio Service (`portfolio_service/`)

**Purpose:** Tracks user holdings, calculates portfolio value and performance metrics.

### Structure:
```
portfolio_service/src/
├── main.ts                    # Service entry point
├── app.module.ts              # Database & module setup
├── app.controller.ts          # Basic health check
├── app.service.ts             # Core service
│
├── auth/
│   ├── jwt.strategy.ts        # JWT validation
│   └── api_key.guard.ts       # Internal API key for service-to-service
│
└── holding/
    ├── holding.controller.ts  # HTTP endpoints:
    │                           # GET /portfolio - Get user's holdings
    │                           # PUT /portfolio/holding - Update holding (internal)
    │                           # DELETE /portfolio/holding/:assetId - Sell all
    │
    ├── holding.service.ts     # Business logic:
    │                           # getPortfolio() - User's all holdings
    │                           # updateHolding() - Called by trading service
    │                           # calculates total value & performance
    │
    ├── entities/
    │   └── holding.entity.ts  # Holding database model
    │                           # (userId, assetId, quantity, avgCost)
    │
    └── holding.module.ts      # Module configuration
```

---

## 🔐 Authentication Flow

1. **User Registration/Login**: `user_service` creates JWT token
2. **Token Storage**: Frontend stores in localStorage
3. **API Requests**: 
   - Frontend sends `Authorization: Bearer <token>` header
   - `api_gateway` proxies to appropriate service
   - Service validates JWT using `jwt.strategy.ts`
4. **Internal Service Calls**: Services use `x-internal-api-key` header for service-to-service authentication

---

## 📊 Database

- **Type**: PostgreSQL (shared single database)
- **Configuration**: TypeORM with auto-migration enabled
- **Tables**: 
  - `user` (user_service)
  - `wallet` (wallet_service)
  - `asset` (marketplace_service)
  - `liquidity_pool`, `price_history` (trading_service)
  - `holding` (portfolio_service)

---

## 🔄 Service Communication

### Frontend → Backend
```
Frontend → API Gateway (Port 8080) → Microservice
```

### Service → Service (Internal)
```
Services communicate directly via internal Docker network URLs:
- user_service:3001
- wallet_service:3002
- marketplace_service:3003
- trading_service:3004
- portfolio_service:3005
```

### Environment Variables (Docker Compose)
- `USER_SERVICE_URL=http://user_service:3001`
- `WALLET_SERVICE_URL=http://wallet_service:3002`
- `MARKETPLACE_SERVICE_URL=http://marketplace_service:3003`
- `TRADING_SERVICE_URL=http://trading_service:3004`
- `PORTFOLIO_SERVICE_URL=http://portfolio_service:3005`
- `DATABASE_URL=postgresql://user:password@postgres_db:5432/stonks_main_db`
- `JWT_SECRET=<secret>`
- `INTERNAL_API_KEY=<key>`

---

## 🏗️ Common Service Structure

All services follow this pattern:

```
service/
├── src/
│   ├── main.ts                      # Entry point
│   ├── app.module.ts                # Module imports & config
│   ├── app.controller.ts            # Health check
│   ├── app.service.ts               # Core logic
│   ├── auth/                        # Authentication strategies & guards
│   ├── [feature]/                   # Domain-specific folder (user, trade, asset, etc)
│   │   ├── [feature].controller.ts  # HTTP endpoints
│   │   ├── [feature].service.ts     # Business logic
│   │   ├── [feature].module.ts      # Module config
│   │   ├── entities/                # Database models
│   │   └── dto/                     # Request/response validation
│   └── [more features...]
├── test/
│   ├── app.e2e-spec.ts              # End-to-end tests
│   └── jest-e2e.json                # Jest config
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
└── Dockerfile                       # Container configuration
```

---

## 🚀 Deployment

Each service has a `Dockerfile` and runs in its own Docker container. Docker Compose orchestrates all services with PostgreSQL database.

```bash
docker-compose up    # Start all services
docker-compose down  # Stop all services
```
