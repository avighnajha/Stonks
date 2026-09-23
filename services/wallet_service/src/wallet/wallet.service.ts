import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}
  async getWallet(userId: string) {
    if (!userId) throw new NotFoundException('Wallet not found');
    const wallet = await this.walletRepository.findOne({
      where: { user_id: userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }
  getAllWallets() {
    return this.walletRepository.find();
  }
}
