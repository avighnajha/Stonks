import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Holding } from "./entities/holding.entity";
import { Repository } from "typeorm";
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
    ){}
    async getPortfolio(userId: string): Promise<PortfolioHoldingDto[]>{
        const tradeServiceUrl = 'http://trade_service:3004/trade/prices'
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
    async updateHoldings(userId, assetId, quantity, tradePrice){
        const holdings = await this.holdingRepository.findOne({where: {user_id: userId, asset_id: assetId}})
        
        if (!holdings){
            if (quantity<0){
                throw new BadRequestException("Cannot sell an asset the user does not own.")
            }
            const newHolding = this.holdingRepository.create({
                user_id: userId,
                asset_id: assetId,
                quantity: quantity,
                average_buy_price: tradePrice
            })
            return await this.holdingRepository.save(newHolding)
        }else {
            const total = (holdings.average_buy_price*holdings.quantity)
            holdings.quantity += quantity
            const newAvg = (total + (quantity*tradePrice))/ (holdings.quantity)
            holdings.average_buy_price = newAvg
            return await this.holdingRepository.save(holdings)
        }
    }

}
