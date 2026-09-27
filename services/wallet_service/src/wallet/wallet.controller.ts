import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { InternalApiKeyGuard } from '../auth/api_key.guard';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}
  @Get('balance')
  @UseGuards(AuthGuard('jwt'))
  getBalance(@Request() req) {
    return this.walletService.getWallet(req.user.userId);
  }
  @Get('admin/all')
  @UseGuards(InternalApiKeyGuard)
  getAllWallets() {
    return this.walletService.getAllWallets();
  }
}
