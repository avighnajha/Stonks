Phase 1: Database & Entity Refactoring (Trading Service)

The LiquidityPool entity is now obsolete. We need to track "Intents" (Orders) and "Executions" (Trades).

1.1 Update trading_service Entities

Create Order Entity:

id, userId, assetId.

side: Enum (BUY, SELL).

type: Enum (LIMIT, MARKET).

status: Enum (OPEN, PARTIAL, FILLED, CANCELLED).

price: Decimal (The limit price).

initialQuantity: Decimal.

remainingQuantity: Decimal (Used for partial fills).

Create Trade Entity:

id, buyerId, sellerId, assetId, price, quantity, timestamp.

buyOrderId, sellOrderId (Links to the original orders).

Phase 2: The "Locking" Logic (Wallet & Portfolio)

In an Order Book, you cannot spend money that is currently tied up in a "Pending" Buy Order.

2.1 Update wallet_service

Schema: Add frozen_balance column to the Wallet entity.

Logic: - When a user places a BUY order, balance decreases and frozen_balance increases.

If the order is cancelled, frozen_balance moves back to balance.

If the order is filled, frozen_balance is deducted permanently.

2.2 Update portfolio_service

Schema: Add frozen_quantity to the Holding entity.

Logic: - When a user places a SELL order, the assets are "frozen" so they can't be sold twice.

Phase 3: The Matching Engine (Trading Service)

This is the core logic. When a new order arrives, the service must check if it can be filled immediately.

3.1 The processOrder Workflow

Receive Order: User submits a Buy Order for Asset A at $10.

Lock Funds: Call wallet_service to move price * qty to frozen_balance.

Query Order Book: Look for SELL orders where price <= $10 for Asset A.

Match Logic:

No Match: Save order to DB with status OPEN.

Match Found:

Determine execution price (usually the price of the existing order).

Calculate quantity (min of Buyer's need vs Seller's supply).

Create a Trade record.

Update remainingQuantity for both orders.

If remainingQuantity == 0, set status to FILLED.

Settlement: - Call wallet_service to move money from Buyer to Seller.

Call portfolio_service to move Asset from Seller to Buyer.

Phase 4: Real-time Updates (API Gateway)

Bots and "God Mode" need to see the book moving in real-time.

4.1 WebSocket Integration

Gateway: Implement a MarketGateway using socket.io.

Events:

order_created: Emitted when a new limit order hits the book.

trade_executed: Emitted when a match occurs (updates the "Last Price").

order_book_sync: Emitted every second to show the "Level 2" (all bids/asks).

Phase 5: Price Discovery Refactor (Marketplace Service)

Current: Gets price from Asset table or LiquidityPool.

New: Must query the trading_service for the Last Trade Price.

Endpoint Change: GET /assets should now perform a JOIN or a service-call to get the most recent price from the Trades table.