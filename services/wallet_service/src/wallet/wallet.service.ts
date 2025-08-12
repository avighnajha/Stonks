import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { And, Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';

@Injectable()
export class WalletService{
    constructor(
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
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
        console.log("Debiting from wallet: ", amount, ", available balance: ", wallet.balance)
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
        console.log(`--------> WALLET SERVICE     Og balance ${og_balance} new balance ${wallet.balance}`)
        return this.walletRepository.save(wallet);
    }
}