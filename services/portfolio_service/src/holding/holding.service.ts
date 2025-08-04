import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Holding } from "./entities/holding.entity";
import { Repository } from "typeorm";
import { ArgumentOutOfRangeError, firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";

@Injectable()
export class HoldingService{
    constructor(
        @InjectRepository(Holding)
        private readonly holdingRepository: Repository<Holding>,
        private readonly httpService: HttpService
    ){}
    async getPortfolio(userId){
        const tradeServiceUrl = 'http://trade_service:3004/trade/prices'
        const holdings = await this.holdingRepository.find({where: {user_id: userId}})
        try{
            const prices = await firstValueFrom(
                this.httpService.get(tradeServiceUrl,

                    {
                        headers:{'x-internal-api-key': process.env.INTERNAL_API_KEY}
                    }
                )
            )
            for (const holding of holdings){
                holding.price = prices[holding.asset_id]
        }
        } catch (error){
            throw error;
        }
        
        return holdings;
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
