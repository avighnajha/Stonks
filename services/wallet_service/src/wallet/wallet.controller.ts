import {Controller, Get, Post, Request, UseGuards, ValidationPipe} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';

@Controller('wallet')
export class WalletController {
    constructor(
        private readonly walletService: WalletService,
    ){}

    @Get('balance')
    @UseGuards(AuthGuard('jwt'))
    getBalance(@Request() req){
        const userId = req.user.userId;
        return this.walletService.getWallet(userId);
    }

    @Post()
    createWallet(@Body() createWalletDto: CreateWalletDto) {
        return this.walletService.createWallet(createWalletDto.userId);
    }
}