import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Request, UseGuards, ValidationPipe } from "@nestjs/common";
import { TradeService } from "./trade.service";
import { AuthGuard } from "@nestjs/passport";
import { IsArray, IsNumber, IsPositive, IsUUID } from "class-validator";
import { InternalApiKeyGuard } from "src/auth/api_key.guard";
import { create } from "domain";


class TradeDto {
    @IsNumber()
    @IsPositive()
    assetAmount: number
}

class GetPricesDto {
  // Ensures the incoming body has a property 'assetIds'
  @IsArray()
  @IsUUID('4', { each: true })
  assetIds: string[];
}

class CreatePoolDto {
    assetId: string
}

@Controller('trade')
export class TradeController{
    constructor(private readonly tradeService: TradeService){}
    
    @Post('create-pool')
    @UseGuards(InternalApiKeyGuard)
    async createPool(@Body(ValidationPipe) createPoolDto: CreatePoolDto ){
        const {assetId} = createPoolDto;
        return this.tradeService.createPool(assetId);
    }

    @Get('quote/:assetId')
    async getQuote(@Param('assetId', ParseUUIDPipe) assetId: string){
        console.log("Quoting: ", assetId)
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

    @Post('prices')
    @UseGuards(InternalApiKeyGuard)
    getPrices(@Body(ValidationPipe) getPricesDto: GetPricesDto){
        return this.tradeService.getPrices(getPricesDto.assetIds)
    }
}