import { BadRequestException, Injectable, NotFoundException, Logger } from "@nestjs/common";
import * as fs from 'fs';
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, Repository } from "typeorm";
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
        private readonly httpService: HttpService,
        private readonly entityManager: EntityManager,
        private readonly redisService: RedisService,
    ){}

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

    async getHistory(assetId: string){
        return this.priceHistoryRepository.find({
            where:{ asset_id: assetId },
            order: { timestamp: 'ASC' }
        });
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
        return this.entityManager.transaction(async (transactionalEntityManager) => {
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

            // Publish order book update to Redis (orders changed)
            try {
                await this.redisService.publishOrderBookUpdate(assetId);
            } catch (err) {
                this.logger.warn(`Failed to publish order book update to Redis for asset ${assetId}: ${err?.message || err}`);
            }

            // Keep any partially or fully unfilled order open on the book.
            return { 
                message: 'Order processed successfully.', 
                status: order.status,
                filledQuantity: quantity - order.remaining_quantity,
                orderId: order.id
            };
        })}

    async getPrices(assetIds: string[]): Promise<{ assetId: string; price: number }[]> {
        if (assetIds.length === 0) return [];
        
        const latestTrades = await this.tradeRepository
            .createQueryBuilder('trade')
            .where('trade.asset_id IN (:...assetIds)', { assetIds })
            .orderBy('trade.timestamp', 'DESC')
            .getMany();

        const seen = new Set<string>();
        const prices: { assetId: string; price: number }[] = [];
        for (const t of latestTrades) {
            if (!seen.has(t.asset_id)) {
                prices.push({ assetId: t.asset_id, price: Number(t.price) });
                seen.add(t.asset_id);
            }
        }
        return prices;
    }
}