import { BadRequestException, Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, Repository } from "typeorm";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";
import { PriceHistory } from "./entities/price-history.entity";
import { LiquidityPool } from "./entities/liquidity_pool.entity";
import { Order, OrderSide, OrderStatus, OrderType } from "./entities/order.entity";
import { Trade } from "./entities/trade.entity";
import { RedisService } from '../redis/redis.service';


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
                    await firstValueFrom(this.httpService.post(this.walletFreezeUrl, 
                        { userId, amount: totalCost }, 
                        { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                    ));
                } else {
                    await firstValueFrom(this.httpService.post(this.portfolioFreezeUrl, 
                        { userId, assetId, quantity }, 
                        { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                    ));
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
                    await firstValueFrom(this.httpService.post(this.walletSettleUrl, 
                        { buyerId: trade.buyer_id, sellerId: trade.seller_id, amount: tradePrice * tradeQuantity }, 
                        { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                    ));

                    await firstValueFrom(this.httpService.post(this.portfolioSettleUrl, 
                        { buyerId: trade.buyer_id, sellerId: trade.seller_id, assetId, quantity: tradeQuantity, tradePrice }, 
                        { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                    ));
                } catch (settleError) {
                    const failures: string[] = [];

                    // Attempt compensating unfreeze for buyer funds
                    try {
                        await firstValueFrom(this.httpService.post(this.walletBase + '/wallet/unfreeze',
                            { userId: trade.buyer_id, amount: tradePrice * tradeQuantity },
                            { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                        ));
                    } catch (e) {
                        failures.push(`wallet.unfreeze for buyer ${trade.buyer_id} failed: ${e?.response?.data || e?.message || e}`);
                    }

                    // Attempt compensating unfreeze for seller holdings
                    try {
                        await firstValueFrom(this.httpService.post(this.portfolioBase + '/portfolio/unfreeze',
                            { userId: trade.seller_id, assetId, quantity: tradeQuantity },
                            { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                        ));
                    } catch (e) {
                        failures.push(`portfolio.unfreeze for seller ${trade.seller_id} failed: ${e?.response?.data || e?.message || e}`);
                    }

                    if (failures.length > 0) {
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

            // If original order was not fully filled, unfreeze the remaining portion and surface errors if unfreeze fails
            if (order.remaining_quantity > 0 && order.status !== OrderStatus.FILLED) {
                if (side === OrderSide.BUY) {
                    const amountToUnfreeze = Number(order.remaining_quantity) * Number(order.price);
                    try {
                        await firstValueFrom(this.httpService.post(this.walletBase + '/wallet/unfreeze',
                            { userId, amount: amountToUnfreeze },
                            { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                        ));
                    } catch (e) {
                        throw new BadRequestException({ message: 'Failed to unfreeze remaining wallet funds for original BUY order', detail: e?.response?.data || e?.message || e });
                    }
                } else {
                    try {
                        await firstValueFrom(this.httpService.post(this.portfolioBase + '/portfolio/unfreeze',
                            { userId, assetId, quantity: Number(order.remaining_quantity) },
                            { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                        ));
                    } catch (e) {
                        throw new BadRequestException({ message: 'Failed to unfreeze remaining holdings for original SELL order', detail: e?.response?.data || e?.message || e });
                    }
                }
            }

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