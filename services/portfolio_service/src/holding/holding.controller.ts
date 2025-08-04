import { Body, Controller, Get, Patch, Request, UseGuards, ValidationPipe } from "@nestjs/common";
import { HoldingService } from "./holding.service";
import { AuthGuard } from "@nestjs/passport";
import { InternalApiKeyGuard } from "src/auth/api_key.guard";
import { equal } from "assert";

class UpdateholdingsDto {
    userId: string;
    assetId: string;
    //+ve buy, -ve sell
    quantity: number;
    tradePrice: number;
}

@Controller('portfolio')
export class HoldingController{
    constructor(private readonly holdingService: HoldingService){}

    @Get()
    @UseGuards(AuthGuard('jwt'))
    getPortfolio(@Request() req){
        const {userId} = req.user.user_id;
        return this.holdingService.getPortfolio(userId)
    }

    @Patch("holding")
    @UseGuards(InternalApiKeyGuard)
    updateHoldings(@Body(ValidationPipe) updateHoldingsDto: UpdateholdingsDto){
        const {userId, assetId, quantity, tradePrice} = updateHoldingsDto;
        return this.holdingService.updateHoldings(userId, assetId, quantity, tradePrice);
    }
}