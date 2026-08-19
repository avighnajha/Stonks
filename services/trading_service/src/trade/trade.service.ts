import { BadRequestException, Injectable, NotFoundException, Logger } from "@nestjs/common";
import * as fs from 'fs';
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, MoreThan, Repository } from "typeorm";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";
import { PriceHistory } from "./entities/price-history.entity";
import { LiquidityPool } from "./entities/liquidity_pool.entity";
import { Order, OrderSide, OrderStatus, OrderType } from "./entities/order.entity";
import { Trade } from "./entities/trade.entity";
import { RedisService } from '../redis/redis.service';
import { enqueueCompensation } from '../compensation/compensation.worker';


@Injectable()
export class TradeService {
    private readonly logger = new Logger(TradeService.name);
    // Use environment-provided service URLs when available, otherwise fall back to Docker service hostnames.
    private readonly walletBase = process.env.WALLET_SERVICE_URL || 'http://wallet_service:3002';
    private readonly portfolioBase = process.env.PORTFOLIO_SERVICE_URL || 'http://portfolio_service:3005';
    private readonly walletFreezeUrl = `${this.walletBase}/wallet/freeze`;
    private readonly portfolioFreezeUrl = `${this.portfolioBase}/portfolio/freeze`;
    private readonly walletSettleUrl = `${this.walletBase}/wallet/settle`;
    private readonly portfolioSettleUrl = `${this.portfolioBase}/portfolio/settle`;
    constructor(
        @InjectRepository(Trade)
        private readonly tradeRepository: Repository<Trade>,
        @InjectRepository(PriceHistory)
        private readonly priceHistoryRepository: Repository<PriceHistory>,
        @InjectRepository(LiquidityPool)
        private readonly liquidityPoolRepository: Repository<LiquidityPool>,
        @InjectRepository(Order)
        private readonly orderRepository: Repository<Order>,
        private readonly httpService: HttpService,
        private readonly entityManager: EntityManager,
        private readonly redisService: RedisService
    ){
        // Schedule cleanup every 24 hours
        setInterval(() => {
            this.cleanupOldPriceHistory().catch(err => {
                this.logger.error('Failed to cleanup old price history', err);
            });
        }, 24 * 60 * 60 * 1000);
    }

    private async postWithRetry(url: string, payload: any, options: any = {}, attempts = 3, baseDelayMs = 200) {
        let lastErr: any = null;
        for (let i = 0; i < attempts; i++) {
            try {
                if (i > 0) this.logger.warn(`Retrying HTTP POST ${url} attempt #${i + 1}`);
                await firstValueFrom(this.httpService.post(url, payload, options));
                return;
            } catch (e) {
                lastErr = e;
                const delay = Math.min(baseDelayMs * Math.pow(2, i), 5000);
                this.logger.warn(`POST ${url} failed (attempt ${i + 1}/${attempts}): ${e?.message || e}; delaying ${delay}ms`);
                await new Promise((res) => setTimeout(res, delay));
            }
        }
        throw lastErr;
    }

    async getQuote(assetId: string): Promise<{price: number}>{
        const lastTrade = await this.tradeRepository.findOne({
            where: { asset_id: assetId },
            order: { timestamp: 'DESC' }
        });
        return { price: lastTrade ? lastTrade.price : 0 };
    }

    async getHistory(assetId: string, timeframe?: string, days?: number){
        const daysToFetch = days || 3;
        const since = new Date();
        since.setDate(since.getDate() - daysToFetch);

        const query = this.priceHistoryRepository.createQueryBuilder('ph')
            .where('ph.asset_id = :assetId', { assetId })
            .andWhere('ph.timestamp >= :since', { since })
            .orderBy('ph.timestamp', 'ASC');

        // If no timeframe, return raw data
        if (!timeframe) {
            return await query.getMany();
        }

        // Parse timeframe (e.g., '5m', '1h', '1d')
        const timeframeMs = this.parseTimeframe(timeframe);
        const rawData = await query.getMany();

        // Aggregate data by timeframe
        return this.aggregateByTimeframe(rawData, timeframeMs);
    }

    private parseTimeframe(timeframe: string): number {
        const match = timeframe.match(/^(\d+)([mhd])$/);
        if (!match) return 300000; // Default 5 minutes

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 300000;
        }
    }

    private aggregateByTimeframe(data: any[], intervalMs: number): any[] {
        if (data.length === 0) return [];

        const aggregated: any[] = [];
        let currentInterval = Math.floor(data[0].timestamp.getTime() / intervalMs) * intervalMs;
        let open = data[0].price;
        let high = data[0].price;
        let low = data[0].price;
        let close = data[0].price;

        for (let i = 1; i < data.length; i++) {
            const point = data[i];
            const pointTime = point.timestamp.getTime();
            const pointInterval = Math.floor(pointTime / intervalMs) * intervalMs;

            if (pointInterval !== currentInterval) {
                // Push previous interval
                aggregated.push({
                    timestamp: new Date(currentInterval),
                    open,
                    high,
                    low,
                    close
                });

                // Start new interval
                currentInterval = pointInterval;
                open = point.price;
                high = point.price;
                low = point.price;
                close = point.price;
            } else {
                // Update current interval
                high = Math.max(high, point.price);
                low = Math.min(low, point.price);
                close = point.price;
            }
        }

        // Push last interval
        aggregated.push({
            timestamp: new Date(currentInterval),
            open,
            high,
            low,
            close
        });

        return aggregated;
    }

    async cleanupOldPriceHistory() {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const result = await this.priceHistoryRepository
            .createQueryBuilder('ph')
            .delete()
            .where('ph.timestamp < :threeDaysAgo', { threeDaysAgo })
            .execute();

        this.logger.log(`Cleaned up ${result.affected} old price history records`);
    }

    async createPool(assetId: string) {
        const existingPool = await this.liquidityPoolRepository.findOne({ where: { asset_id: assetId } });
        if (existingPool) {
            return existingPool;
        }

        const pool = this.liquidityPoolRepository.create({
            asset_id: assetId,
            asset_balance: 0,
            currency_balance: 0,
        });
        return this.liquidityPoolRepository.save(pool);
    }

    async placeOrder(assetId: string, userId: string, side: string, type: OrderType, price: number, quantity: number) {
        const result = await this.entityManager.transaction(async (transactionalEntityManager) => {
            // Freeze
            try {
                    if (side === OrderSide.BUY) {
                    const totalCost = price * quantity;
                    const payload = { userId, amount: totalCost };
                    this.logger.log(`Freezing buyer wallet funds: ${JSON.stringify(payload)}`);
                    await this.postWithRetry(this.walletFreezeUrl, payload, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }, 3, 200);
                    this.logger.log(`Buyer wallet freeze succeeded for ${userId}`);
                } else {
                    const payload = { userId, assetId, quantity };
                    this.logger.log(`Freezing seller portfolio holdings: ${JSON.stringify(payload)}`);
                    await this.postWithRetry(this.portfolioFreezeUrl, payload, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }, 3, 200);
                    this.logger.log(`Seller portfolio freeze succeeded for ${userId}`);
                }
            } catch (error) {
                throw new BadRequestException('Failed to freeze assets/funds. Ensure you have enough balance.');
            }
            
            // Current intent
            const order = transactionalEntityManager.create(Order, {
                user_id: userId,
                asset_id: assetId,
                side: side as OrderSide,
                type: type,
                status: OrderStatus.OPEN,
                price: price,
                initial_quantity: quantity,
                remaining_quantity: quantity,
            });
            await transactionalEntityManager.save(order);
            
            // All matches
            const counterSide = side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;
            const orderSort = side === OrderSide.BUY ? { price: 'ASC', created_at: 'ASC' } : { price: 'DESC', created_at: 'ASC' };
            const counterOrders = await transactionalEntityManager.find(Order, {
                where: {
                    asset_id: assetId,
                    side: counterSide,
                    status: In([OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED]),
                },
                order: orderSort as any,
                lock: {mode: 'pessimistic_write'},
            });

            // Order filling loop
            for (const counterOrder of counterOrders) {
                if (order.remaining_quantity <= 0) break;

                // Prevent self-matching on the order book
                if (counterOrder.user_id === userId) {
                    continue;
                }

                const isMarket = order.type === OrderType.MARKET || counterOrder.type === OrderType.MARKET;
                const isMatch = isMarket
                    ? true
                    : (side === OrderSide.BUY ? order.price >= counterOrder.price : order.price <= counterOrder.price);

                if (!isMatch) continue;

                const tradePrice = Number(counterOrder.price);
                const tradeQuantity = Math.min(Number(order.remaining_quantity), Number(counterOrder.remaining_quantity));

                order.remaining_quantity -= tradeQuantity;
                counterOrder.remaining_quantity -= tradeQuantity;

                order.status = order.remaining_quantity === 0 ? OrderStatus.FILLED : OrderStatus.PARTIALLY_FILLED;
                counterOrder.status = counterOrder.remaining_quantity === 0 ? OrderStatus.FILLED : OrderStatus.PARTIALLY_FILLED;

                await transactionalEntityManager.save(counterOrder);

                // Record Trade
                const trade = transactionalEntityManager.create(Trade, {
                    asset_id: assetId,
                    price: tradePrice,
                    quantity: tradeQuantity,
                    buyer_id: side === OrderSide.BUY ? userId : counterOrder.user_id,
                    seller_id: side === OrderSide.SELL ? userId : counterOrder.user_id,
                    buy_order_id: side === OrderSide.BUY ? order.id : counterOrder.id,
                    sell_order_id: side === OrderSide.SELL ? order.id : counterOrder.id,
                });
                await transactionalEntityManager.save(trade);

                // Publish trade event to Redis
                try {
                    await this.redisService.publishTrade(assetId, tradePrice, tradeQuantity);
                } catch (err) {
                    this.logger.warn(`Failed to publish trade to Redis for asset ${assetId}: ${err?.message || err}`);
                }

                // Log Price History
                const pricePoint = transactionalEntityManager.create(PriceHistory, {
                    asset_id: assetId,
                    price: tradePrice
                });
                await transactionalEntityManager.save(pricePoint);

                // Settle Funds
                try {
                    // Optional test hook: if /tmp/trading_test_delay_ms exists in container,
                    // pause here to allow external test orchestration (stop services, etc.).
                    try {
                        const delayFile = '/tmp/trading_test_delay_ms';
                        if (fs.existsSync(delayFile)) {
                            const raw = fs.readFileSync(delayFile, 'utf8').trim();
                            const ms = Number(raw) || 0;
                            if (ms > 0) {
                                this.logger.warn(`Test delay active: sleeping ${ms}ms before settle`);
                                await new Promise((res) => setTimeout(res, ms));
                            }
                        }
                    } catch (e) {
                        // ignore test hook errors
                    }
                    await this.postWithRetry(this.walletSettleUrl, 
                        { buyerId: trade.buyer_id, sellerId: trade.seller_id, amount: tradePrice * tradeQuantity }, 
                        { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } },
                        3,
                        200
                    );

                    await this.postWithRetry(this.portfolioSettleUrl, 
                        { buyerId: trade.buyer_id, sellerId: trade.seller_id, assetId, quantity: tradeQuantity, tradePrice }, 
                        { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } },
                        3,
                        200
                    );
                } catch (settleError) {
                    const failures: string[] = [];

                    // Attempt compensating unfreeze for buyer funds
                    try {
                        const payloadBuyer = { userId: trade.buyer_id, amount: tradePrice * tradeQuantity };
                        this.logger.warn(`Attempting compensating wallet.unfreeze for buyer ${trade.buyer_id} payload=${JSON.stringify(payloadBuyer)}`);
                        await this.postWithRetry(this.walletBase + '/wallet/unfreeze', payloadBuyer, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }, 5, 500);
                        this.logger.log(`Compensating wallet.unfreeze for buyer ${trade.buyer_id} succeeded`);
                    } catch (e) {
                        const errDetail = e?.response?.data || e?.message || String(e);
                        this.logger.error(`Compensating wallet.unfreeze failed for buyer ${trade.buyer_id}: ${errDetail}`);
                        failures.push(`wallet.unfreeze for buyer ${trade.buyer_id} failed: ${errDetail}`);
                        try {
                            await enqueueCompensation('wallet_unfreeze', { userId: trade.buyer_id, amount: tradePrice * tradeQuantity });
                        } catch (qe) {
                            this.logger.error(`Failed to enqueue wallet_unfreeze compensation for buyer ${trade.buyer_id}: ${qe?.message || qe}`);
                        }
                    }

                    // Attempt compensating unfreeze for seller holdings
                    try {
                        const payloadSeller = { userId: trade.seller_id, assetId, quantity: tradeQuantity };
                        this.logger.warn(`Attempting compensating portfolio.unfreeze for seller ${trade.seller_id} payload=${JSON.stringify(payloadSeller)}`);
                        await this.postWithRetry(this.portfolioBase + '/portfolio/unfreeze', payloadSeller, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }, 5, 500);
                        this.logger.log(`Compensating portfolio.unfreeze for seller ${trade.seller_id} succeeded`);
                    } catch (e) {
                        const errDetail = e?.response?.data || e?.message || String(e);
                        this.logger.error(`Compensating portfolio.unfreeze failed for seller ${trade.seller_id}: ${errDetail}`);
                        failures.push(`portfolio.unfreeze for seller ${trade.seller_id} failed: ${errDetail}`);
                        try {
                            await enqueueCompensation('portfolio_unfreeze', { userId: trade.seller_id, assetId, quantity: tradeQuantity });
                        } catch (qe) {
                            this.logger.error(`Failed to enqueue portfolio_unfreeze compensation for seller ${trade.seller_id}: ${qe?.message || qe}`);
                        }
                    }

                    if (failures.length > 0) {
                        // Enqueue any failed compensations for async retry (durable)
                        try {
                            for (const f of failures) {
                                // failures are strings describing which side failed; we also queued above immediately when each failed
                            }
                        } catch (e) {
                            this.logger.error('Failed to enqueue compensations: ' + (e?.message || e));
                        }
                        throw new BadRequestException({ message: 'Settlement failed and compensating unfreeze partially/fully failed', details: failures, original: settleError?.message || settleError });
                    }

                    throw new BadRequestException({ message: 'Settlement failed during execution; compensating unfreeze succeeded', original: settleError?.message || settleError });
                }
            }

            // Save state of the original order after the matching loop
            await transactionalEntityManager.save(order);

            // Keep any partially or fully unfilled order open on the book.
            return { 
                message: 'Order processed successfully.', 
                status: order.status,
                filledQuantity: quantity - order.remaining_quantity,
                orderId: order.id
            };
        });

        try {
            await this.publishOrderBookSnapshot(assetId);
        } catch (err) {
            this.logger.warn(`Failed to publish order book snapshot to Redis for asset ${assetId}: ${err?.message || err}`);
        }

        return result;
    }

    async getOrderBookSnapshot(assetId: string) {
        this.logger.log(`Fetching order book for asset ${assetId}`);

        const buys = await this.orderRepository.find({
            where: {
                asset_id: assetId,
                side: OrderSide.BUY,
                status: In([OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED]),
            },
            order: { price: 'DESC', created_at: 'ASC' },
            take: 15,
        });

        const sells = await this.orderRepository.find({
            where: {
                asset_id: assetId,
                side: OrderSide.SELL,
                status: In([OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED]),
            },
            order: { price: 'ASC', created_at: 'ASC' },
            take: 15,
        });

        this.logger.log(`Order book for ${assetId}: ${buys.length} buys, ${sells.length} sells`);

        return { buys, sells };
    }

    async publishOrderBookSnapshot(assetId: string) {
        const book = await this.getOrderBookSnapshot(assetId);
        await this.redisService.publishOrderBookUpdate(assetId, book);
    }

    async getAllTrades() {
        const trades = await this.tradeRepository.find({
            order: { timestamp: 'DESC' },
            take: 100,
        });
        this.logger.log(`Found ${trades.length} total trades`);
        return trades;
    }

    async getMarketStats() {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentTrades = await this.tradeRepository.find({
            where: { timestamp: MoreThan(since) },
        });

        this.logger.log(`Found ${recentTrades.length} trades in last 24 hours`);

        const volumeByAsset = new Map<string, number>();
        for (const trade of recentTrades) {
            const assetId = trade.asset_id;
            const tradeVolume = Number(trade.price) * Number(trade.quantity);
            volumeByAsset.set(assetId, (volumeByAsset.get(assetId) || 0) + tradeVolume);
        }

        const assetIds = Array.from(new Set(recentTrades.map((trade) => trade.asset_id)));
        this.logger.log(`Unique assets with recent trades: ${assetIds.length}`);

        const lastPrices = new Map<string, number>();
        const previousPrices = new Map<string, number>();

        if (assetIds.length > 0) {
            const latestPricesRaw = await this.tradeRepository.createQueryBuilder('trade')
                .select(['trade.asset_id as asset_id', 'trade.price as price'])
                .where('trade.asset_id IN (:...assetIds)', { assetIds })
                .orderBy('trade.asset_id', 'ASC')
                .addOrderBy('trade.timestamp', 'DESC')
                .getRawMany();

            for (const row of latestPricesRaw) {
                if (!lastPrices.has(row.asset_id)) {
                    lastPrices.set(row.asset_id, Number(row.price));
                }
            }

            const previousPricesRaw = await this.priceHistoryRepository.createQueryBuilder('ph')
                .select(['ph.asset_id as asset_id', 'ph.price as price'])
                .where('ph.asset_id IN (:...assetIds)', { assetIds })
                .andWhere('ph.timestamp <= :since', { since })
                .orderBy('ph.asset_id', 'ASC')
                .addOrderBy('ph.timestamp', 'DESC')
                .getRawMany();

            for (const row of previousPricesRaw) {
                if (!previousPrices.has(row.asset_id)) {
                    previousPrices.set(row.asset_id, Number(row.price));
                }
            }
        }

        const totalVolume = Array.from(volumeByAsset.values()).reduce((sum, v) => sum + v, 0);

        const topByVolume = Array.from(volumeByAsset.entries())
            .map(([assetId, volume]) => ({ assetId, volume }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);

        const gainersAndLosers = Array.from(lastPrices.entries()).map(([assetId, lastPrice]) => {
            const previousPrice = previousPrices.get(assetId) ?? lastPrice;
            const change = lastPrice - previousPrice;
            const percentChange = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
            return { assetId, currentPrice: lastPrice, previousPrice, change, percentChange };
        });

        const gainers = gainersAndLosers
            .filter((item) => item.previousPrice > 0)
            .sort((a, b) => b.percentChange - a.percentChange)
            .slice(0, 5);

        const losers = gainersAndLosers
            .filter((item) => item.previousPrice > 0)
            .sort((a, b) => a.percentChange - b.percentChange)
            .slice(0, 5);

        return {
            volume24h: totalVolume,
            topAssetsByVolume: topByVolume,
            topGainers: gainers,
            topLosers: losers,
        };
    }

    async getPrices(assetIds: string[]): Promise<{ assetId: string; price: number }[]> {
        if (assetIds.length === 0) return [];

        this.logger.log(`Fetching prices for ${assetIds.length} assets`);

        const latestTrades = await this.tradeRepository
            .createQueryBuilder('trade')
            .where('trade.asset_id IN (:...assetIds)', { assetIds })
            .orderBy('trade.timestamp', 'DESC')
            .getMany();

        this.logger.log(`Found ${latestTrades.length} trades for price lookup`);

        const seen = new Set<string>();
        const prices: { assetId: string; price: number }[] = [];
        for (const t of latestTrades) {
            if (!seen.has(t.asset_id)) {
                prices.push({ assetId: t.asset_id, price: Number(t.price) });
                seen.add(t.asset_id);
            }
        }
        this.logger.log(`Returning prices for ${prices.length} unique assets`);
        return prices;
    }

    async cancelOrder(orderId: string, userId: string) {
        const order = await this.orderRepository.findOne({ where: { id: orderId } });
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        const assetId = order.asset_id;

        const result = await this.entityManager.transaction(async (transactionalEntityManager) => {
            const lockedOrder = await transactionalEntityManager.findOne(Order, {
                where: { id: orderId },
                lock: { mode: 'pessimistic_write' }
            });

            if (!lockedOrder) {
                throw new NotFoundException('Order not found');
            }

            if (lockedOrder.user_id !== userId) {
                throw new BadRequestException('You can only cancel your own orders');
            }

            if (lockedOrder.status !== OrderStatus.OPEN && lockedOrder.status !== OrderStatus.PARTIALLY_FILLED) {
                throw new BadRequestException('Order cannot be cancelled. It is already ' + lockedOrder.status);
            }

            const remainingQuantity = Number(lockedOrder.remaining_quantity);
            if (remainingQuantity <= 0) {
                throw new BadRequestException('Order has no remaining quantity to cancel');
            }

            const price = Number(lockedOrder.price);
            const unfreezeAmount = price * remainingQuantity;

            try {
                if (lockedOrder.side === OrderSide.BUY) {
                    const payload = { userId, amount: unfreezeAmount };
                    this.logger.log(`Unfreezing buyer wallet funds for cancelled order: ${JSON.stringify(payload)}`);
                    await this.postWithRetry(this.walletBase + '/wallet/unfreeze', payload, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }, 3, 200);
                    this.logger.log(`Buyer wallet unfreeze succeeded for ${userId}`);
                } else {
                    const payload = { userId, assetId: lockedOrder.asset_id, quantity: remainingQuantity };
                    this.logger.log(`Unfreezing seller portfolio holdings for cancelled order: ${JSON.stringify(payload)}`);
                    await this.postWithRetry(this.portfolioBase + '/portfolio/unfreeze', payload, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }, 3, 200);
                    this.logger.log(`Seller portfolio unfreeze succeeded for ${userId}`);
                }
            } catch (error) {
                this.logger.error(`Failed to unfreeze assets for cancelled order: ${error?.message || error}`);
                throw new BadRequestException('Failed to unfreeze assets/funds. Please try again or contact support.');
            }

            lockedOrder.status = OrderStatus.CANCELLED;
            lockedOrder.remaining_quantity = 0;
            await transactionalEntityManager.save(lockedOrder);

            return {
                message: 'Order cancelled successfully',
                orderId: lockedOrder.id,
                unfrozenAmount: lockedOrder.side === OrderSide.BUY ? unfreezeAmount : undefined,
                unfrozenQuantity: lockedOrder.side === OrderSide.SELL ? remainingQuantity : undefined
            };
        });

        try {
            await this.publishOrderBookSnapshot(assetId);
        } catch (err) {
            this.logger.warn(`Failed to publish order book snapshot to Redis for asset ${assetId}: ${err?.message || err}`);
        }

        return result;
    }
}