import {Body, Controller, Get, NotFoundException, Post, Request, UseGuards, ValidationPipe} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { NotFoundError } from 'rxjs';


class CreateWalletDto{
    userId: string;
}
class UpdateBalanceDto{
    amount: number
}

@Controller('wallet')
export class WalletController {
    constructor(
        private readonly walletService: WalletService,
    ){}

    @Get('balance')
    @UseGuards(AuthGuard('jwt'))
    getBalance(@Request() req){
        const userId = req.user.userId;
        const wallet = this.walletService.getWallet(userId);
        return wallet;
    }

    @Post()
    createWallet(@Body() createWalletDto: CreateWalletDto) {
        return this.walletService.createWallet(createWalletDto.userId);
    }

    @Post('debit')
    @UseGuards(AuthGuard('jwt'))
    debit(@Request() req, @Body(ValidationPipe) updateBalanceDto:UpdateBalanceDto){
        const {userId} = req.user.userId;
        const {amount} = updateBalanceDto;

        return this.walletService.changeBalance(userId, amount, true)
    }
    @Post('credit')
    @UseGuards(AuthGuard('jwt'))
    credit(@Request() req, @Body(ValidationPipe) updateBalanceDto: UpdateBalanceDto){
        const {userId} = req.user.userId;
        const {amount} = updateBalanceDto;
        return this.walletService.changeBalance(userId, amount, false)
    }
}