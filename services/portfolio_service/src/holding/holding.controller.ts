import { Body, Controller, Get, Patch, Request, UseGuards, ValidationPipe } from "@nestjs/common";
import { HoldingService } from "./holding.service";
import { AuthGuard } from "@nestjs/passport";
import { InternalApiKeyGuard } from "src/auth/api_key.guard";


class UpdateholdingsDto {
    userId: string;
    assetId: string;
    //+ve buy, -ve sell
    quantity: number;
    tradePrice: number;
}

class FreezeHoldingsDto {
    userId: string;
    assetId: string;
    quantity: number;
}

class SettlePortfolioDto {
    buyerId: string;
    sellerId: string;
    assetId: string;
    quantity: number;
}

@Controller('portfolio')
export class HoldingController{
    constructor(private readonly holdingService: HoldingService){}

    @Get()
    @UseGuards(AuthGuard('jwt'))
    getPortfolio(@Request() req){
        const {userId} = req.user.userId;
        return this.holdingService.getPortfolio(userId)
    }

    @Patch("update")
    @UseGuards(InternalApiKeyGuard)
    updateHoldings(@Body(ValidationPipe) updateHoldingsDto: UpdateholdingsDto){
        const {userId, assetId, quantity, tradePrice} = updateHoldingsDto;
        console.log('------>PORTFOLIO SERVICE          Updating portolio for: ', userId, quantity, tradePrice)
        return this.holdingService.updateHoldings(userId, assetId, quantity, tradePrice);
    }

    @Post('freeze')
    @UseGuards(InternalApiKeyGuard)
    freezeHoldings(@Body(ValidationPipe) freezeDto: FreezeHoldingsDto){
        const { userId, assetId, quantity } = freezeDto;
        console.log('------>PORTFOLIO SERVICE          Freezing holdings for: ', userId, assetId, quantity)
        return this.holdingService.freezeHoldings(userId, assetId, quantity);
    }

    @Post('unfreeze')
    @UseGuards(InternalApiKeyGuard)
    unfreezeHoldings(@Body(ValidationPipe) freezeDto: FreezeHoldingsDto){
        const { userId, assetId, quantity } = freezeDto;
        console.log('------>PORTFOLIO SERVICE          Unfreezing holdings for: ', userId, assetId, quantity)
        return this.holdingService.unfreezeHoldings(userId, assetId, quantity);
    }

    @Post('settle')
    @UseGuards(InternalApiKeyGuard)
    settle(@Body(ValidationPipe) settleDto: SettlePortfolioDto){
        const { buyerId, sellerId, assetId, quantity } = settleDto;
        console.log('------>PORTFOLIO SERVICE          Settling holdings for: ', buyerId, sellerId, assetId, quantity)
        return this.holdingService.settleTrade(buyerId, sellerId, assetId, quantity);
    }
}