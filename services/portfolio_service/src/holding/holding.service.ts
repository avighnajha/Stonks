import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { Holding } from "./entities/holding.entity";
import { Repository, EntityManager } from "typeorm";
import { ArgumentOutOfRangeError, firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";

class PortfolioHoldingDto {
    assetId: string;
    quantity: number;
    averageBuyPrice: number;
    currentPrice: number;
    currentValue: number;
    profitLoss: number;
}

@Injectable()
export class HoldingService{
    constructor(
        @InjectRepository(Holding)
        private readonly holdingRepository: Repository<Holding>,
        private readonly httpService: HttpService
        , @InjectEntityManager()
        private readonly entityManager: EntityManager
    ){}

    async getPortfolio(userId: string): Promise<PortfolioHoldingDto[]>{
        const tradeServiceUrl = 'http://trading_service:3004/trade/prices'
        const holdings = await this.holdingRepository.find({where: {user_id: userId}})
        const assetIds = holdings.map(holding=>holding.asset_id)
        try{
            const response = await firstValueFrom(
                this.httpService.post<{assetId:string; price: number}[]>(tradeServiceUrl,
                    {assetIds: assetIds},
                    {
                        headers:{'x-internal-api-key': process.env.INTERNAL_API_KEY}
                    }
                )
            )
            const pricesData = response.data;

            const priceMap = new Map<string, number>();
            for (const priceInfo of pricesData){
                priceMap.set(priceInfo.assetId, priceInfo.price)
            }
            const portfolioWithValues: PortfolioHoldingDto[] = holdings.map(holding =>{
                const currentPrice = priceMap.get(holding.asset_id)||0;
                const quantity = parseFloat(holding.quantity as any)
                const averageBuyPrice = parseFloat(holding.average_buy_price as any);
                const currentValue = currentPrice*quantity;
                const profitLoss = currentValue - (averageBuyPrice*quantity)
                return {
                    assetId: holding.asset_id,
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
        const holding = await this.holdingRepository.findOne({ where: { user_id: userId, asset_id: assetId } });
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
            console.log(holding.quantity, quantityChange)
        
            const currentQuantity = parseFloat(holding.quantity as any);
            const currentAvgPrice = parseFloat(holding.average_buy_price as any);
            const changeAmount = parseFloat(quantityChange as any);
            const newTradePrice = parseFloat(tradePrice as any);

            const newQuantity = currentQuantity + changeAmount;
            console.log(currentQuantity, changeAmount)
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
            console.log("New quantity of stock after buying", newQuantity)
            holding.quantity = newQuantity;
            return await this.holdingRepository.save(holding);
        }
    }

    // Freeze holdings when placing a sell order
    async freezeHoldings(userId: string, assetId: string, quantity: number): Promise<Holding>{
        const holding = await this.holdingRepository.findOne({ where: { user_id: userId, asset_id: assetId } });
        if (!holding) {
            throw new BadRequestException("Holding not found for the specified asset.");
        }
        const quantityNum = Number(quantity);
        if (holding.quantity < quantityNum){
            throw new BadRequestException("Insufficient holdings to freeze.");
        }
        holding.quantity = Number(holding.quantity) - quantityNum;
        holding.frozen_quantity = Number(holding.frozen_quantity) + quantityNum;
        return await this.holdingRepository.save(holding);
    }

    // Unfreeze holdings if order is cancelled or partially filled
    async unfreezeHoldings(userId: string, assetId: string, quantity: number): Promise<Holding>{
        const holding = await this.holdingRepository.findOne({ where: { user_id: userId, asset_id: assetId } });
        if (!holding) {
            throw new BadRequestException("Holding not found for the specified asset.");
        }
        const quantityNum = Number(quantity);
        if (holding.frozen_quantity < quantityNum){
            throw new BadRequestException("Insufficient frozen holdings to unfreeze.");
        }
        holding.quantity = Number(holding.quantity) + quantityNum;
        holding.frozen_quantity = Number(holding.frozen_quantity) - quantityNum;
        return await this.holdingRepository.save(holding);
    }

    async settleTrade(buyerId: string, sellerId: string, assetId: string, quantity: number) {
        return this.entityManager.transaction(async (transactionalEntityManager) => {
            const sellerHolding = await transactionalEntityManager.findOne(Holding, {
                where: { user_id: sellerId, asset_id: assetId },
                lock: { mode: 'pessimistic_write' }
            });

            const buyerHolding = await transactionalEntityManager.findOne(Holding, {
                where: { user_id: buyerId, asset_id: assetId },
                lock: { mode: 'pessimistic_write' }
            });

            if (!sellerHolding) {
                throw new NotFoundException('Seller holding not found for asset.');
            }

            const qty = Number(quantity);
            if (Number(sellerHolding.frozen_quantity) < qty) {
                throw new BadRequestException('Seller does not have enough frozen holdings to settle.');
            }

            // Deduct from seller frozen, add to buyer available
            sellerHolding.frozen_quantity = Number(sellerHolding.frozen_quantity) - qty;

            if (buyerHolding) {
                buyerHolding.quantity = Number(buyerHolding.quantity) + qty;
                await transactionalEntityManager.save(buyerHolding);
            } else {
                const newHolding = transactionalEntityManager.create(Holding, {
                    user_id: buyerId,
                    asset_id: assetId,
                    quantity: qty,
                    frozen_quantity: 0,
                    average_buy_price: 0
                });
                await transactionalEntityManager.save(newHolding);
            }

            await transactionalEntityManager.save(sellerHolding);

            return { message: 'Trade settled successfully in portfolio.' };
        });
    }
}