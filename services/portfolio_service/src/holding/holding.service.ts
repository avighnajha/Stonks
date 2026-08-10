import { BadRequestException, Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { Holding } from "./entities/holding.entity";
import { Repository, EntityManager } from "typeorm";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";

class PortfolioHoldingDto {
    assetId: string;
    name?: string;
    quantity: number;
    averageBuyPrice: number;
    currentPrice: number;
    currentValue: number;
    profitLoss: number;
}

@Injectable()
export class HoldingService{
    private readonly logger = new Logger(HoldingService.name);
    constructor(
        @InjectRepository(Holding)
        private readonly holdingRepository: Repository<Holding>,
        private readonly httpService: HttpService
        , @InjectEntityManager()
        private readonly entityManager: EntityManager
    ){}

    private async consolidateHoldingRows(userId: string, assetId: string, manager?: EntityManager): Promise<Holding | null> {
        const repository = manager ? manager.getRepository(Holding) : this.holdingRepository;
        let query = repository.createQueryBuilder('h')
            .where('h.user_id = :userId', { userId })
            .andWhere('h.asset_id = :assetId', { assetId });

        if (manager) {
            query = query.setLock('pessimistic_write');
        }

        const holdings = await query.getMany();

        if (!holdings || holdings.length === 0) {
            return null;
        }

        if (holdings.length === 1) {
            return holdings[0];
        }

        let totalQuantity = 0;
        let totalFrozen = 0;
        let weightedCost = 0;

        for (const holding of holdings) {
            const quantity = Number(holding.quantity) || 0;
            totalQuantity += quantity;
            totalFrozen += Number(holding.frozen_quantity) || 0;
            weightedCost += quantity * (Number(holding.average_buy_price) || 0);
        }

        const primary = holdings[0];
        primary.quantity = totalQuantity;
        primary.frozen_quantity = totalFrozen;
        primary.average_buy_price = totalQuantity > 0 ? weightedCost / totalQuantity : 0;
        await repository.save(primary);

        const duplicates = holdings.slice(1);
        await repository.remove(duplicates);

        return primary;
    }

    private aggregatePortfolioHoldings(holdings: Holding[]): PortfolioHoldingDto[] {
        const grouped = new Map<string, {
            assetId: string;
            quantity: number;
            averageBuyPrice: number;
        }>();

        for (const holding of holdings) {
            const assetId = holding.asset_id;
            const quantity = Number(holding.quantity) || 0;
            const averageBuyPrice = Number(holding.average_buy_price) || 0;
            const existing = grouped.get(assetId);

            if (!existing) {
                grouped.set(assetId, {
                    assetId,
                    quantity,
                    averageBuyPrice: quantity > 0 ? averageBuyPrice : 0,
                });
            } else {
                const combinedQuantity = existing.quantity + quantity;
                const combinedCost = (existing.averageBuyPrice * existing.quantity) + (averageBuyPrice * quantity);
                grouped.set(assetId, {
                    assetId,
                    quantity: combinedQuantity,
                    averageBuyPrice: combinedQuantity > 0 ? combinedCost / combinedQuantity : 0,
                });
            }
        }

        return Array.from(grouped.values()).map((group) => ({
            assetId: group.assetId,
            quantity: group.quantity,
            averageBuyPrice: group.averageBuyPrice,
            currentPrice: 0,
            currentValue: 0,
            profitLoss: 0,
        }));
    }

    async getPortfolio(userId: string): Promise<PortfolioHoldingDto[]>{
        const tradeServiceUrl = 'http://trading_service:3004/trade/prices'
        const assetServiceUrl = 'http://marketplace_service:3003/assets'
        const holdings = await this.holdingRepository.find({where: {user_id: userId}})
        const assetIds = holdings.map(holding=>holding.asset_id)
        try{
            this.logger.log(`getPortfolio: calling trade/prices with assetIds=${JSON.stringify(assetIds)}`);
            const [pricesResponse, assetsResponse] = await Promise.all([
                firstValueFrom(
                    this.httpService.post<{assetId:string; price: number}[]>(tradeServiceUrl,
                        {assetIds: assetIds},
                        {
                            headers:{'x-internal-api-key': process.env.INTERNAL_API_KEY}
                        }
                    )
                ),
                firstValueFrom(
                    this.httpService.get<{id:string; name:string; initial_price?: number}[]>(`${assetServiceUrl}/approved`, {
                        headers:{'x-internal-api-key': process.env.INTERNAL_API_KEY}
                    })
                )
            ]);

            const pricesData = pricesResponse.data;
            const assetsData = assetsResponse.data;

            const priceMap = new Map<string, number>();
            for (const priceInfo of pricesData){
                priceMap.set(priceInfo.assetId, priceInfo.price)
            }

            const assetNameMap = new Map<string, string>();
            const assetInitialPriceMap = new Map<string, number>();
            for (const assetInfo of assetsData) {
                assetNameMap.set(assetInfo.id, assetInfo.name);
                if (assetInfo.initial_price != null) {
                    assetInitialPriceMap.set(assetInfo.id, Number(assetInfo.initial_price));
                }
            }

            const aggregatedHoldings = this.aggregatePortfolioHoldings(holdings);
            const portfolioWithValues: PortfolioHoldingDto[] = aggregatedHoldings.map(holding =>{
                const currentPrice = priceMap.get(holding.assetId) ?? assetInitialPriceMap.get(holding.assetId) ?? 0;
                const quantity = holding.quantity;
                const averageBuyPrice = holding.averageBuyPrice;
                const currentValue = currentPrice*quantity;
                const profitLoss = currentValue - (averageBuyPrice*quantity)
                return {
                    assetId: holding.assetId,
                    name: assetNameMap.get(holding.assetId) ?? holding.assetId,
                    quantity: quantity,
                    averageBuyPrice: averageBuyPrice,
                    currentPrice: currentPrice,
                    currentValue: currentValue,
                    profitLoss: profitLoss,
                };
            });
            return portfolioWithValues;
        }
        catch (error){
            throw error;
        }
    }

    async updateHoldings(userId: string, assetId: string, quantityChange: number, tradePrice: number) {
        const holding = await this.consolidateHoldingRows(userId, assetId);
        if (!holding) {
            // This is a new holding (first time buying this asset)
            if (quantityChange < 0) {
                throw new BadRequestException("Cannot sell an asset the user does not own.");
            }
            const newHolding = this.holdingRepository.create({
                user_id: userId,
                asset_id: assetId,
                quantity: quantityChange,
                average_buy_price: tradePrice,
            });
            return await this.holdingRepository.save(newHolding);
        } else {
            // This is an existing holding
            this.logger.debug(`Existing holding quantity=${holding.quantity}, quantityChange=${quantityChange}`);
        
            const currentQuantity = parseFloat(holding.quantity as any);
            const currentAvgPrice = parseFloat(holding.average_buy_price as any);
            const changeAmount = parseFloat(quantityChange as any);
            const newTradePrice = parseFloat(tradePrice as any);

            const newQuantity = currentQuantity + changeAmount;
            this.logger.debug(`currentQuantity=${currentQuantity} changeAmount=${changeAmount}`)
            if (newQuantity < 0) {
                throw new BadRequestException("User does not own enough stock to sell.");
            }

            //Handle "sell all" case ---
            if (newQuantity === 0) {

                return await this.holdingRepository.remove(holding);
            }

            // --- Only recalculate average price on a BUY ---
            if (quantityChange > 0) { // This is a BUY order
                const totalCost = (currentAvgPrice * currentQuantity) + (tradePrice * quantityChange);
                holding.average_buy_price = totalCost / newQuantity;
            }
            // If it's a SELL order, the average_buy_price does not change.
            this.logger.log(`New quantity of stock after buying ${newQuantity}`)
            holding.quantity = newQuantity;
            return await this.holdingRepository.save(holding);
        }
    }

    // Mint holdings directly to a user without involving wallet operations.
    async mintHolding(userId: string, assetId: string, quantity: number) {
        if (quantity <= 0) {
            throw new BadRequestException('Mint quantity must be positive');
        }

        const existing = await this.consolidateHoldingRows(userId, assetId);
        if (!existing) {
            const newHolding = this.holdingRepository.create({
                user_id: userId,
                asset_id: assetId,
                quantity: quantity,
                frozen_quantity: 0,
                average_buy_price: 0,
            });
            return await this.holdingRepository.save(newHolding);
        }

        const currentQuantity = parseFloat(existing.quantity as any) || 0;
        existing.quantity = (currentQuantity + Number(quantity));
        // average_buy_price remains unchanged for minted assets (cost = 0)
        return await this.holdingRepository.save(existing);
    }

    // Freeze holdings when placing a sell order
    async freezeHoldings(userId: string, assetId: string, quantity: number): Promise<Holding>{
        const holding = await this.consolidateHoldingRows(userId, assetId);
        if (!holding) {
            throw new BadRequestException("Holding not found for the specified asset.");
        }
        const quantityNum = Number(quantity);
        this.logger.log(`freezeHoldings BEFORE user=${userId} asset=${assetId} quantity=${holding.quantity} frozen=${holding.frozen_quantity} willFreeze=${quantityNum}`);
        if (Number(holding.quantity) < quantityNum){
            throw new BadRequestException("Insufficient holdings to freeze.");
        }
        holding.quantity = Number(holding.quantity) - quantityNum;
        holding.frozen_quantity = Number(holding.frozen_quantity) + quantityNum;
        const saved = await this.holdingRepository.save(holding);
        this.logger.log(`freezeHoldings AFTER user=${userId} asset=${assetId} quantity=${saved.quantity} frozen=${saved.frozen_quantity}`);
        return saved;
    }

    // Unfreeze holdings if order is cancelled or partially filled
    async unfreezeHoldings(userId: string, assetId: string, quantity: number): Promise<Holding>{
        const holding = await this.consolidateHoldingRows(userId, assetId);
        if (!holding) {
            throw new BadRequestException("Holding not found for the specified asset.");
        }
        const quantityNum = Number(quantity);
        this.logger.log(`unfreezeHoldings BEFORE user=${userId} asset=${assetId} quantity=${holding.quantity} frozen=${holding.frozen_quantity} willUnfreeze=${quantityNum}`);
        const available = Number(holding.frozen_quantity);
        if (available <= 0) {
            this.logger.warn(`unfreezeHoldings: nothing to unfreeze for user=${userId} asset=${assetId}`);
            return holding;
        }
        const toUnfreeze = Math.min(available, quantityNum);
        if (toUnfreeze < quantityNum) {
            this.logger.warn(`unfreezeHoldings: requested ${quantityNum} > available ${available}, unfreezing ${toUnfreeze} instead`);
        }
        holding.quantity = Number(holding.quantity) + toUnfreeze;
        holding.frozen_quantity = Number(holding.frozen_quantity) - toUnfreeze;
        const saved = await this.holdingRepository.save(holding);
        this.logger.log(`unfreezeHoldings AFTER user=${userId} asset=${assetId} quantity=${saved.quantity} frozen=${saved.frozen_quantity}`);
        return saved;
    }

    async settleTrade(buyerId: string, sellerId: string, assetId: string, quantity: number) {
        return this.entityManager.transaction(async (transactionalEntityManager) => {
            const sellerHolding = await this.consolidateHoldingRows(sellerId, assetId, transactionalEntityManager);
            if (!sellerHolding) {
                throw new NotFoundException('Seller holding not found for asset.');
            }

            const qty = Number(quantity);
            const frozenAvailable = Number(sellerHolding.frozen_quantity || 0);
            if (frozenAvailable < qty) {
                throw new BadRequestException('Seller does not have enough frozen holdings to settle.');
            }

            sellerHolding.frozen_quantity = frozenAvailable - qty;
            await transactionalEntityManager.save(sellerHolding);

            const buyerHolding = await this.consolidateHoldingRows(buyerId, assetId, transactionalEntityManager);
            if (buyerHolding) {
                buyerHolding.quantity = Number(buyerHolding.quantity || 0) + qty;
                await transactionalEntityManager.save(buyerHolding);
            } else {
                const newHolding = transactionalEntityManager.create(Holding, {
                    user_id: buyerId,
                    asset_id: assetId,
                    quantity: qty,
                    frozen_quantity: 0,
                    average_buy_price: 0,
                });
                await transactionalEntityManager.save(newHolding);
            }

            return { message: 'Trade settled successfully in portfolio.' };
        });
    }

    // Debug helper: return raw holdings for a user
    async cleanupDuplicateHoldings() {
        const holdings = await this.holdingRepository.find();
        const grouped = new Map<string, Holding[]>();

        for (const holding of holdings) {
            const key = `${holding.user_id}:${holding.asset_id}`;
            const group = grouped.get(key) || [];
            group.push(holding);
            grouped.set(key, group);
        }

        let cleanedGroups = 0;
        let duplicatesRemoved = 0;

        for (const [key, group] of grouped.entries()) {
            if (group.length <= 1) continue;

            cleanedGroups += 1;
            let totalQuantity = 0;
            let totalFrozen = 0;
            let weightedCost = 0;

            for (const holding of group) {
                totalQuantity += Number(holding.quantity) || 0;
                totalFrozen += Number(holding.frozen_quantity) || 0;
                weightedCost += (Number(holding.quantity) || 0) * (Number(holding.average_buy_price) || 0);
            }

            const primary = group[0];
            primary.quantity = totalQuantity;
            primary.frozen_quantity = totalFrozen;
            primary.average_buy_price = totalQuantity > 0 ? weightedCost / totalQuantity : 0;
            await this.holdingRepository.save(primary);

            const duplicates = group.slice(1);
            await this.holdingRepository.remove(duplicates);
            duplicatesRemoved += duplicates.length;
        }

        return { cleanedGroups, duplicatesRemoved };
    }

    // Debug helper: return raw holdings for a user
    async getHoldingsForUser(userId: string) {
        return this.holdingRepository.find({ where: { user_id: userId } });
    }

    async getAllHoldings() {
        return this.holdingRepository.find();
    }
}