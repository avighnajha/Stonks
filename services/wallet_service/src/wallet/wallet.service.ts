import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { And, Repository, EntityManager } from 'typeorm';
import { Wallet } from './entities/wallet.entity';

import { InjectEntityManager } from '@nestjs/typeorm';

@Injectable()
export class WalletService{
    private readonly logger = new Logger(WalletService.name);
    constructor(
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        @InjectEntityManager()
        private readonly entityManager: EntityManager,
    ){}

    async createWallet(userId: string): Promise<Wallet>{
        const newWallet = this.walletRepository.create({
            user_id: userId,
            balance:10000
        });
        return this.walletRepository.save(newWallet);
    }

    async getWallet(userId: string){
        const wallet = await this.walletRepository.findOne(
            {where:
                {user_id: userId}
            });
        if (!wallet){
            throw new NotFoundException('Wallet not found');
        }
        return wallet;
    }
    // debit = False = credit
    async changeBalance(userId: string, amount: number, debit: boolean): Promise<Wallet> {
        const wallet = await this.getWallet(userId);
        const amountNum = Number(amount);
        this.logger.debug(`Debiting from wallet: ${amount}, available balance: ${wallet.balance}`)
        if(!wallet){
            throw new NotFoundException('Wallet not found');
        }
        if (debit && wallet.balance < amountNum){
            throw new BadRequestException('Insufficient balance.')
        }
        const og_balance = wallet.balance;
        if (debit){
            wallet.balance = Number(wallet.balance) - amountNum;
        } else {
            wallet.balance = Number(wallet.balance) + amountNum;
        }
        this.logger.log(`--------> WALLET SERVICE Og balance ${og_balance} new balance ${wallet.balance}`)
        return this.walletRepository.save(wallet);
    }

    async freezeFunds(userId: string, amount: number): Promise<Wallet>{
        const wallet = await this.getWallet(userId);
        const amountNum = Number(amount);
        if(!wallet){
            throw new NotFoundException('Wallet not found');
        }
        if (wallet.balance < amountNum){
            throw new BadRequestException('Insufficient balance.')
        }
        wallet.balance = Number(wallet.balance) - amountNum;
        wallet.frozen_balance = Number(wallet.frozen_balance) + amountNum;
        return this.walletRepository.save(wallet);
    }

    async unfreezeFunds(userId: string, amount: number): Promise<Wallet>{
        const wallet = await this.getWallet(userId);
        const amountNum = Number(amount);
        if(!wallet){
            throw new NotFoundException('Wallet not found');
        }
        if (wallet.frozen_balance < amountNum){
            throw new BadRequestException('Insufficient frozen balance.')
        }
        wallet.balance = Number(wallet.balance) + amountNum;
        wallet.frozen_balance = Number(wallet.frozen_balance) - amountNum;
        return this.walletRepository.save(wallet);
    }

    async settleTrade(buyerId: string, sellerId: string, amount: number) {
        return this.entityManager.transaction(async (transactionalEntityManager) => {
            const buyerWallet = await transactionalEntityManager.findOne(Wallet, {
                where: { user_id: buyerId },
                lock: { mode: 'pessimistic_write' }
            });

            const sellerWallet = await transactionalEntityManager.findOne(Wallet, {
                where: { user_id: sellerId },
                lock: { mode: 'pessimistic_write' }
            });

            if (!buyerWallet || !sellerWallet) {
                throw new NotFoundException('Buyer or Seller wallet not found.');
            }

            if (Number(buyerWallet.frozen_balance) < amount) {
                throw new BadRequestException('Buyer does not have enough frozen funds to settle this trade.');
            }
            buyerWallet.frozen_balance = Number(buyerWallet.frozen_balance) - amount;

            sellerWallet.balance = Number(sellerWallet.balance) + amount;

            await transactionalEntityManager.save(buyerWallet);
            await transactionalEntityManager.save(sellerWallet);

            return { message: 'Trade settled successfully in wallets.' };
        });
    }
}