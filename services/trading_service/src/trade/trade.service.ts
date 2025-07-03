import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Liquidity_pool } from "./entities/liquidity_pool.entity";

@Injectable()
export class trade_service {
    constructor(
        @InjectRepository(Liquidity_pool)
        private readonly liqpoolRepository: Repository<Liquidity_pool>
    ){}
    async getQuote(assetId: string): Promise<number>{
        const pool = await this.liqpoolRepository.findOne({where:{id: assetId}});
        if (!pool){
            throw new NotFoundException('Liquidity pool not found.')
        }
        return pool.currency_balance/pool.asset_balance;
    }

    executeBuy(assetId: string, amount: number){
        
    }

    executeSell(){}
}