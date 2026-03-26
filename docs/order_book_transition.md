Instructions for the Agent: Follow this sequence exactly. Do not skip phases. Check off [x] each item only after the code is saved and the service compiles.

🏗️ Phase 1: The "Escrow" Layer (Wallet & Portfolio)
Goal: Ensure users cannot "double-spend" while an order is open.

[ ] 1.1 Update Wallet Entity * File: services/wallet_service/src/wallet/entities/wallet.entity.ts

Action: Add @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) frozenBalance: number;

[ ] 1.2 Create Freeze/Unfreeze Logic * File: services/wallet_service/src/wallet/wallet.service.ts

Action: Add freezeFunds(userId, amount) (Balance → Frozen) and unfreezeFunds(userId, amount) (Frozen → Balance).

[ ] 1.3 Update Portfolio Entity * File: services/portfolio_service/src/holding/entities/holding.entity.ts

Action: Add @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 }) frozenQuantity: number;

[ ] 1.4 Create Asset Freeze Logic * File: services/portfolio_service/src/holding/holding.service.ts

Action: Add freezeAssets(userId, assetId, qty) and unfreezeAssets(userId, assetId, qty).

📉 Phase 2: Trading Service Redesign
Goal: Delete AMM logic and replace with Order & Trade tracking.

[ ] 2.1 Cleanup AMM * Action: Delete services/trading_service/src/trade/entities/liquidity_pool.entity.ts.

Action: Remove all references to k = x * y in trade.service.ts.

[ ] 2.2 Create Order Entity * File: services/trading_service/src/trade/entities/order.entity.ts

Fields: id, userId, assetId, side (BUY/SELL), type (LIMIT/MARKET), status (OPEN/PARTIAL/FILLED/CANCELLED), price, initialQuantity, remainingQuantity.

[ ] 2.3 Create Trade Entity * File: services/trading_service/src/trade/entities/trade.entity.ts

Fields: id, assetId, price, quantity, buyerId, sellerId, buyOrderId, sellOrderId, timestamp.

[ ] 2.4 Implement Matching Engine * File: services/trading_service/src/trade/matching-engine.service.ts

Logic: Implement Price-Time Priority matching (match new order against existing counter-side orders).

🚀 Phase 3: The Order Placement Flow
Goal: Handle the actual lifecycle of a trade.

[ ] 3.1 Refactor Trade Placement * File: services/trading_service/src/trade/trade.service.ts

Action: Update placeOrder() to:

Call Wallet/Portfolio to Freeze assets.

Save Order as OPEN.

Trigger Matching Engine.

[ ] 3.2 Implement Settlement Logic * Action: If match found, call wallet_service to transfer funds from Buyer's frozen to Seller's balance. Call portfolio_service to transfer assets.