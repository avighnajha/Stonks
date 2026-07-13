import { Body, Controller, Get, Patch, Post, Request, UseGuards, ValidationPipe, Logger } from "@nestjs/common";
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

class MintHoldingDto {
    userId: string;
    assetId: string;
    quantity: number;
}

@Controller('portfolio')
export class HoldingController{
    private readonly logger = new Logger(HoldingController.name);
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
        this.logger.log(`------>PORTFOLIO SERVICE Updating portfolio for: ${userId} qty=${quantity} price=${tradePrice}`)
        return this.holdingService.updateHoldings(userId, assetId, quantity, tradePrice);
    }

    @Post('freeze')
    @UseGuards(InternalApiKeyGuard)
    freezeHoldings(@Body(ValidationPipe) freezeDto: FreezeHoldingsDto){
        const { userId, assetId, quantity } = freezeDto;
        this.logger.log(`------>PORTFOLIO SERVICE Freezing holdings for: ${userId} ${assetId} qty=${quantity}`)
        return this.holdingService.freezeHoldings(userId, assetId, quantity);
    }

    @Post('unfreeze')
    @UseGuards(InternalApiKeyGuard)
    unfreezeHoldings(@Body(ValidationPipe) freezeDto: FreezeHoldingsDto){
        const { userId, assetId, quantity } = freezeDto;
        this.logger.log(`------>PORTFOLIO SERVICE Unfreezing holdings for: ${userId} ${assetId} qty=${quantity}`)
        return this.holdingService.unfreezeHoldings(userId, assetId, quantity);
    }

    @Post('settle')
    @UseGuards(InternalApiKeyGuard)
    settle(@Body(ValidationPipe) settleDto: SettlePortfolioDto){
        const { buyerId, sellerId, assetId, quantity } = settleDto;
        this.logger.log(`------>PORTFOLIO SERVICE Settling holdings for: ${buyerId} ${sellerId} ${assetId} qty=${quantity}`)
        return this.holdingService.settleTrade(buyerId, sellerId, assetId, quantity);
    }

    @Post('mint')
    @UseGuards(InternalApiKeyGuard)
    mint(@Body(ValidationPipe) mintDto: MintHoldingDto){
        const { userId, assetId, quantity } = mintDto;
        this.logger.log(`------>PORTFOLIO SERVICE Minting holdings for: ${userId} ${assetId} qty=${quantity}`)
        return this.holdingService.mintHolding(userId, assetId, quantity);
    }
}