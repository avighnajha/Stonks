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
}