import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Request, UseGuards, ValidationPipe } from "@nestjs/common";
import { TradeService } from "./trade.service";
import { AuthGuard } from "@nestjs/passport";
import { IsNumber, IsPositive } from "class-validator";


export class TradeDto {
    @IsNumber()
    @IsPositive()
    assetAmount: number
}

@Controller('trade')
export class TradeController{
    constructor(private readonly tradeService: TradeService){}

    @Get('quote/:assetId')
    async getQuote(@Param('assetId', ParseUUIDPipe) assetId: string){
        return this.tradeService.getQuote(assetId);
    }

    @Post('buy/:assetId')
    @UseGuards(AuthGuard('jwt'))
    buy(@Request() req,
        @Body(ValidationPipe) tradeDto: TradeDto,
        @Param('assetId', ParseUUIDPipe) assetId: string
    ){
        const userId = req.user.userId;
        const {assetAmount} = tradeDto;
        return this.tradeService.executeBuy(assetId, userId, assetAmount)
    }

    @Post('sell/:assetId')
    @UseGuards(AuthGuard('jwt'))
    sell(@Request() req,
        @Body(ValidationPipe) tradeDto:TradeDto,
        @Param('assetId', ParseUUIDPipe) assetId:string
    ){
        const userId = req.user.userId;
        const { assetAmount} = tradeDto;
        return this.tradeService.executeSell(assetId, userId, assetAmount)
    }
}