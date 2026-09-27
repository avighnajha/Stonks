import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HoldingService } from './holding.service';
import { InternalApiKeyGuard } from '../auth/api_key.guard';

@Controller('portfolio')
export class HoldingController {
  constructor(private readonly holdingService: HoldingService) {}
  @Get()
  @UseGuards(AuthGuard('jwt'))
  getPortfolio(@Request() req) {
    return this.holdingService.getPortfolio(req.user.userId);
  }
  @Get('admin/all')
  @UseGuards(InternalApiKeyGuard)
  getAllHoldings() {
    return this.holdingService.getAllHoldings();
  }
}
