import { BadRequestException, HttpServer, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, Repository } from "typeorm";
import { LiquidityPool } from "./entities/liquidity_pool.entity";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";
import { IsArray, IsUUID } from "class-validator";
import { error } from "console";


@Injectable()
export class TradeService {
    private readonly walletDebitUrl = 'http://wallet_service:3002/wallet/debit';
    private readonly walletCreditUrl = 'http://wallet_service:3002/wallet/credit';
    private readonly portfolioServiceUrl = 'http://portfolio_service:3005/portfolio/update'
    constructor(
        @InjectRepository(LiquidityPool)
        private readonly liqpoolRepository: Repository<LiquidityPool>,
        private readonly httpService: HttpService,
        private readonly entityManager: EntityManager
    ){}
    private async findPool(assetId: string){
        const pool = await this.liqpoolRepository.findOne({where: {asset_id: assetId}})
        if(!pool){
            throw new NotFoundException('Liquidity pool not found')
        }
        return pool;
    }

    async createPool(assetId: string){
        const existingPool = await this.liqpoolRepository.findOne({ where: { asset_id: assetId } });
        if (existingPool) {
            throw new BadRequestException(`A liquidity pool for asset ${assetId} already exists.`);
        }
        const newPool = this.liqpoolRepository.create({
            asset_id: assetId,
            currency_balance: 1000000,
            asset_balance: 10000
        })
        return await this.liqpoolRepository.save(newPool);
    }

    async getQuote(assetId: string): Promise<{price: number}>{
        const pool = await this.findPool(assetId);
        const price = pool.currency_balance/pool.asset_balance;
        return {price};
    }
    async executeBuy(assetId: string, userId: string, stockAmount: number) {
    // Wrap the entire operation in a database transaction for safety.
    return this.entityManager.transaction(async (transactionalEntityManager) => {
        //Find the pool and LOCK THE ROW.
        const pool = await transactionalEntityManager.findOne(LiquidityPool, {
            where: { asset_id: assetId },
            lock: { mode: 'pessimistic_write' },
        });

        if (!pool) {
            throw new NotFoundException('Liquidity pool not found for this asset.');
        }

        const currentStockBalance = parseFloat(pool.asset_balance as any);
        const currentCashBalance = parseFloat(pool.currency_balance as any);
        const stockToBuy = parseFloat(stockAmount as any);

        if (currentStockBalance <= stockToBuy) {
            throw new BadRequestException('Not enough liquidity in the pool.');
        }

        //Calculate the cost of the trade using numeric values.
        const cost = (pool.k / (currentStockBalance - stockToBuy)) - currentCashBalance;
        const pricePerShare = cost / stockToBuy;

        //DEBIT THE WALLET FIRST
        try {
            await firstValueFrom(
                this.httpService.post(
                    this.walletDebitUrl,
                    { userId: userId, amount: cost }, 
                    { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                )
            );
        } catch (error) {
            throw new BadRequestException(error.response?.data?.message || 'Wallet debit failed.');
        }
        
        // IF PAYMENT SUCCEEDS, UPDATE THE PORTFOLIO
        try {
             await firstValueFrom(
                this.httpService.patch(
                    this.portfolioServiceUrl,
                    {
                        userId: userId,
                        assetId: assetId,
                        quantity: stockToBuy, // Positive for a buy
                        tradePrice: pricePerShare
                    },
                    { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }
                )
            );
        } catch (error) {
             // If this fails, the whole transaction will be rolled back automatically.
             throw new Error('Failed to update portfolio. Trade has been rolled back.');
        }

        //FINALLY, UPDATE THE LIQUIDITY POOL
        pool.asset_balance = currentStockBalance - stockToBuy;
        pool.currency_balance = currentCashBalance + cost;
        await transactionalEntityManager.save(pool);

        return { message: `Trade executed successfully! ${stockAmount} stocks of Asset ${assetId} bought.` };
    });
    }
    // async executeBuy(assetId: string, userId: string, stockAmount: number){
    //     const pool = await this.findPool(assetId);
        
    //     if (pool.asset_balance<=stockAmount){
    //         throw new BadRequestException('Not enough liquidity');
    //     }

    //     //Current cost to buy stockAmount number of stocks
    //     const curCost = (pool.k/(pool.asset_balance-stockAmount) - pool.currency_balance)
    //     console.log("User ", userId, "buying ", stockAmount, "number of stocks of total cost", curCost)
    //     //Get money from wallet
    //     try{
    //         await firstValueFrom(
    //             this.httpService.post(this.walletDebitUrl,
    //                 {userId: userId, amount: curCost},
    //                 {
    //                     headers: {
    //                         'x-internal-api-key': process.env.INTERNAL_API_KEY,
    //                     }
    //                 }
    //             ))            
    //       } 
    //     catch (error){
    //         throw error;
    //     }

    //     //Add to portfolio
    //     try{
    //         await firstValueFrom(
    //             this.httpService.patch(this.portfolioServiceUrl,
    //                 {
    //                     userId: userId,
    //                     assetId: assetId,
    //                     quantity: stockAmount,
    //                     trade_price: curCost/stockAmount
    //                 },
    //                 {headers: {'x-internal-api-key': process.env.INTERNAL_API_KEY}}
    //             )
    //         )
    //     }
    //     catch{
    //         await firstValueFrom(
    //             this.httpService.post(this.walletCreditUrl, { userId: userId, amount: curCost }, { headers:{
    //                         'x-internal-api-key': process.env.INTERNAL_API_KEY,
    //                     } })
    //         );
    //         throw error;
    //     }
        
    //     //Update liq pool
    //     pool.asset_balance -= stockAmount;
    //     pool.currency_balance+=curCost;
    //     await this.liqpoolRepository.save(pool)
    //     return {message: `Trade executed succesfully! ${stockAmount} stocks of Stock ${assetId} bought`};
    // }

    async executeSell(assetId: string, userId: string, stockAmount: number){
        const pool = await this.liqpoolRepository.findOne({where:{id:assetId}})

    
        if(!pool){
            throw new NotFoundException('Wallet not found')
        }
        const curCost = ( pool.currency_balance - pool.k/(pool.asset_balance+stockAmount))
        
        //TODO: Conenct to potfolio servie to check if user even has this many stocks to sell.

        try{
            await firstValueFrom(
                this.httpService.post(this.walletCreditUrl,
                    {userId: userId, amount: curCost},
                    {
                        headers: {
                            'x-internal-api-key': process.env.INTERNAL_API_KEY,
                        }
                    }))
                } catch (error){
                    throw error;
                }
                
        
        // Updating portfolio with negative quatity
        try {
            await firstValueFrom(
                this.httpService.patch(this.portfolioServiceUrl,
                    {
                        userId: userId,
                        assetId: assetId,
                        quantity: -stockAmount,
                        tradePrice: curCost/stockAmount
                    },
                    {
                        headers: {
                            'x-internal-api-key': process.env.INTERNAL_API_KEY
                    }}
                )
            )
        } catch(error){
            await firstValueFrom(
                this.httpService.post(this.walletDebitUrl, { userId, amount: curCost }, { headers:{
                            'x-internal-api-key': process.env.INTERNAL_API_KEY,
                        } })
            );
            throw error
        }

        pool.asset_balance+=stockAmount;
        pool.currency_balance-=curCost;
        this.liqpoolRepository.save(pool);

        return {message: `Trade executed succesfully! ${stockAmount} stocks of Stock ${assetId} sold.`};
    }

    async getPrices(assetIds: string[]): Promise<{ assetId: string; price: number }[]>{
        if (assetIds.length==0){
            return [];
        }
        const pools = await this.liqpoolRepository.find({
            where: {
                asset_id: In(assetIds)
            }
        })
       
        return pools.map(pool => ({
            assetId: pool.asset_id,
            price: parseFloat(pool.currency_balance as any) / parseFloat(pool.asset_balance as any),
    }));
    }
}