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
    userId:string
    walletId: string
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
    debit(@Body(ValidationPipe) updateBalanceDto:UpdateBalanceDto){
        const {userId, amount} = updateBalanceDto;
        return this.walletService.changeBalance(userId, amount, true)
    }
    @Post('credit')
    credit(@Body(ValidationPipe) updateBalanceDto: UpdateBalanceDto){
        const {userId, amount} = updateBalanceDto;
        return this.walletService.changeBalance(userId, amount, false)
    }
}