import { BadRequestException, HttpServer, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LiquidityPool } from "./entities/liquidity_pool.entity";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";

@Injectable()
export class TradeService {
    constructor(
        @InjectRepository(LiquidityPool)
        private readonly liqpoolRepository: Repository<LiquidityPool>,
        private readonly httpService: HttpService,
    ){}

    private async findPool(assetId: string){
        const pool = await this.liqpoolRepository.findOne({where: {asset_id: assetId}})
        if(!pool){
            throw new NotFoundException('Liquidity pool not found')
        }
        return pool;
    }

    async getQuote(assetId: string): Promise<{price: number}>{
        const pool = await this.findPool(assetId);
        const price = pool.currency_balance/pool.asset_balance;
        return {price};
    }

    async executeBuy(assetId: string, userId: string, assetAmount: number){
        const pool = await this.findPool(assetId);
        
        const walletServiceUrl = 'http://wallet_service:3002/wallet/debit';
        
        if (pool.asset_balance<=assetAmount){
            throw new BadRequestException('Not enough liquidity');
        }

        //Current cost to buy stockAmount number of stocks
        const curCost = (pool.k/(pool.asset_balance-assetAmount) - pool.currency_balance)
        try{
            pool.asset_balance -= assetAmount;
            pool.currency_balance+=curCost;
            await this.liqpoolRepository.save(pool)
            await firstValueFrom(
                this.httpService.post(walletServiceUrl,
                    {userId: userId, amount: curCost},
                    {
                        headers: {
                            'x-internal-api-key': process.env.INTERNAL_API_KEY,
                        }
                    }
                ))
            } catch (error){
                throw error;
            }

        return {message: `Trade executed succesfully! ${assetAmount} stocks of Stock ${assetId} bought`};
    }

    async executeSell(assetId: string, userId: string, stockAmount: number){
        const pool = await this.liqpoolRepository.findOne({where:{id:assetId}})

        
        const walletServiceUrl = 'http://wallet_service:3002/wallet/credit'

        if(!pool){
            throw new NotFoundException('Wallet not found')
        }
        const curCost = ( pool.currency_balance - pool.k/(pool.asset_balance+stockAmount))
        
        //TODO: Conenct to potfolio servie to check if user even has this many stocks to sell.

        try{
            pool.asset_balance+=stockAmount;
            pool.currency_balance-=curCost;
            this.liqpoolRepository.save(pool);
            await firstValueFrom(
                this.httpService.post(walletServiceUrl,
                    {userId: userId, amount: curCost},
                    {
                        headers: {
                            'x-internal-api-key': process.env.INTERNAL_API_KEY,
                        }
                    }))
        } catch (error){
            throw error;
        }

        return {message: `Trade executed succesfully! ${stockAmount} stocks of Stock ${assetId} sold.`};
    }
}