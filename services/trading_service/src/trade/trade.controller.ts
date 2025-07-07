import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Request, UseGuards, ValidationPipe } from "@nestjs/common";
import { TradeService } from "./trade.service";
import { AuthGuard } from "@nestjs/passport";


class TradeDto {
    userId:string
    assetAmount: number
}

@Controller('trade')
export class TradeController{
    constructor(private readonly tradeService: TradeService){}

    @Get(':assetId')
    async getQuote(@Param('assetId', ParseUUIDPipe) id: string){
        return this.tradeService.getQuote(id);
    }

    @Post('buy/:assetId')
    @UseGuards(AuthGuard('jwt'))
    buy(@Request() req,
        @Body(ValidationPipe) tradeDto: TradeDto,
        @Param('assetId', ParseUUIDPipe) assetId: string
    ){
        const {userId, assetAmount} = tradeDto;
        return this.tradeService.executeBuy(assetId, userId, assetAmount)
    }

    @Post('sell/:assetId')
    @UseGuards(AuthGuard('jwt'))
    sell(@Request() req,
        @Body(ValidationPipe) tradeDto:TradeDto,
        @Param('assetId', ParseUUIDPipe) assetId:string
    ){
        const {userId, assetAmount} = tradeDto;
        return this.tradeService.executeSell(assetId, userId, assetAmount)
    }

    
}