# Frontend-Backend Integration Todo List

## 🚀 **PHASE 1: Core Infrastructure Setup**

### 1.1 API Configuration & Environment Setup (SKIP FOR NOW WILL DO LATER)
- [ ] Update `axiosInstance.ts` to support both local development (`http://localhost:8080`) and production
- [ ] Add environment variables for API base URL
- [ ] Configure axios interceptors for JWT token handling (auto-attach to requests)
- [ ] Add request/response interceptors for error handling and loading states

### 1.2 Authentication System Completion
- [x] Complete `useAuth.tsx` hook to use real API calls instead of mock data
- [x] Implement proper token validation on app startup
- [x] Add token refresh logic for expired tokens
- [x] Implement logout functionality with token cleanup
- [x] Add authentication guards for protected routes

## 📊 **PHASE 2: API Layer Implementation**

### 2.1 Authentication APIs
- [ ] Complete `auth.api.ts` with proper error handling
- [ ] Add user profile API calls (get current user, update profile)

### 2.2 Trading APIs
- [ ] Create `trading.api.ts` with functions for:
  - `getQuote(assetId)` - Get current price for an asset
  - `getPriceHistory(assetId)` - Get historical price data
  - `buyAsset(assetId, amount)` - Execute buy order
  - `sellAsset(assetId, amount)` - Execute sell order
  - `getMultiplePrices(assetIds[])` - Get prices for multiple assets
  - `createLiquidityPool(assetId)` - Admin function to create pools

### 2.3 Marketplace APIs
- [ ] Create `marketplace.api.ts` with functions for:
  - `getAllAssets()` - Get all available assets
  - `getApprovedAssets()` - Get only approved assets
  - `getAssetById(id)` - Get specific asset details
  - `submitAsset(assetData)` - Submit new asset for approval
  - `approveAsset(id)` - Admin function to approve assets

### 2.4 Portfolio APIs
- [ ] Create `portfolio.api.ts` with functions for:
  - `getPortfolio()` - Get user's current holdings and performance
  - `updateHoldings(userId, assetId, quantity, price)` - Internal API for trade updates

### 2.5 Wallet APIs
- [ ] Create `wallet.api.ts` with functions for:
  - `getWalletBalance()` - Get user's current balance
  - `createWallet(userId)` - Internal API for wallet creation
  - `debitWallet(userId, amount)` - Internal API for balance deduction
  - `creditWallet(userId, amount)` - Internal API for balance addition

## 🎨 **PHASE 3: Frontend Data Integration**

### 3.1 Explore Page
- [ ] Replace mock data with real asset data from `/assets/approved`
- [ ] Add real-time price updates using trading API
- [ ] Implement search and filtering functionality
- [ ] Add loading states and error handling

### 3.2 Portfolio Page
- [ ] Replace mock portfolio data with real data from `/portfolio`
- [ ] Integrate wallet balance from `/wallet/balance`
- [ ] Add real-time portfolio value updates
- [ ] Implement portfolio performance calculations

### 3.3 StockDetail Page
- [ ] Replace mock price data with real quotes from `/trade/quote/:assetId`
- [ ] Replace mock historical data with real history from `/trade/history/:assetId`
- [ ] Implement buy/sell functionality using `/trade/buy/:assetId` and `/trade/sell/:assetId`
- [ ] Add real-time price updates (WebSocket integration later)
- [ ] Add form validation and error handling for trades

### 3.4 Trending Page
- [ ] Replace mock trending data with real asset data
- [ ] Implement trending algorithms (volume, price change, etc.)
- [ ] Add real-time updates for trending metrics

## 🔐 **PHASE 4: Authentication & Security**

### 4.1 Route Protection
- [ ] Add authentication guards to protected pages (Portfolio, Trading)
- [ ] Implement redirect logic for unauthenticated users
- [ ] Add role-based UI elements (admin features)

### 4.2 Error Handling
- [ ] Implement global error handling for API calls
- [ ] Add user-friendly error messages
- [ ] Handle network errors and retries
- [ ] Add loading states throughout the app

## 📡 **PHASE 5: Real-Time Features**

### 5.1 WebSocket Integration
- [ ] Implement WebSocket connection to API Gateway
- [ ] Add real-time price updates
- [ ] Add live trade notifications
- [ ] Add portfolio value updates

### 5.2 Live Data Updates
- [ ] Implement polling fallbacks for WebSocket failures
- [ ] Add price change indicators and animations
- [ ] Implement auto-refresh for portfolio data

## 🧪 **PHASE 6: Testing & Polish**

### 6.1 Integration Testing
- [ ] Test complete user flows (register → login → trade → portfolio)
- [ ] Test error scenarios and edge cases
- [ ] Test authentication token handling

## 🔧 **PHASE 7: Advanced Features**

### 7.1 Order Book (Future)
- [ ] Implement order book display
- [ ] Add limit/market order functionality
- [ ] Add order history and management

### 7.2 Admin Dashboard (Future)
- [ ] Build admin interface for asset management
- [ ] Add system monitoring features
- [ ] Implement user management tools

### 7.3 Sentiment Integration (Future)
- [ ] Add Twitter sentiment data display
- [ ] Implement sentiment-driven price indicators
- [ ] Add news feed integration

---

## 📋 **Priority Implementation Order**

1. **Start with Phase 1.1 & 1.2** - Get API configuration working
2. **Complete Phase 2.1** - Authentication APIs
3. **Implement Phase 3.1** - Explore page (easiest to test)
4. **Complete Phase 4.1** - Route protection
5. **Implement Phase 3.2 & 3.3** - Portfolio and StockDetail pages
6. **Add Phase 5.1** - Real-time updates
7. **Polish with Phase 6** - Testing and UI improvements

## 🛠 **Technical Notes**

- Backend uses JWT authentication with Bearer tokens
- Internal APIs use `x-internal-api-key` header
- All trading operations require user authentication
- Portfolio updates happen via internal API calls from trading service
- WebSocket support planned for real-time features
- Database uses PostgreSQL with TypeORM</content>
<parameter name="filePath">/workspaces/Stonks/frontend_backend_integration_todo.md