import { HttpServer, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Liquidity_pool } from "./entities/liquidity_pool.entity";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";

@Injectable()
export class trade_service {
    constructor(
        @InjectRepository(Liquidity_pool)
        private readonly liqpoolRepository: Repository<Liquidity_pool>,
        private readonly httpService: HttpService,
    ){}
    async getQuote(assetId: string): Promise<number>{
        const pool = await this.liqpoolRepository.findOne({where:{id: assetId}});
        if (!pool){
            throw new NotFoundException('Liquidity pool not found.')
        }
        return pool.currency_balance/pool.asset_balance;
    }

    async executeBuy(assetId: string, userId: string, stockAmount: number){
        const pool = await this.liqpoolRepository.findOne({where:{id: assetId}});
        
        const walletServiceUrl = 'http://wallet_service:3002/wallet/debit';
        if (!pool){
            throw new NotFoundException('Liquidity pool not found.')
        }
        
        //Current cost to buy stockAmount number of stocks
        const curCost = (pool.k/(pool.asset_balance-stockAmount) - pool.currency_balance)
        pool.asset_balance -= stockAmount;
        pool.currency_balance+=curCost;
        try{
            await firstValueFrom(
                this.httpService.post(walletServiceUrl, {userId: userId, amount: curCost}))
        } catch (error){
            throw new error;
        }

        return {message: 'Trade executed succesfully!'};
    }

    executeSell(){}
}