import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Request, UseGuards, ValidationPipe } from "@nestjs/common";
import { TradeService } from "./trade.service";
import { AuthGuard } from "@nestjs/passport";
import { IsArray, IsEnum, IsNumber, IsPositive, IsUUID } from "class-validator";
import { InternalApiKeyGuard } from "src/auth/api_key.guard";
import { OrderType } from "./entities/order.entity";

class TradeDto {
    @IsNumber()
    @IsPositive()
    assetAmount: number;

    @IsNumber()
    @IsPositive()
    price: number;

    @IsEnum(OrderType)
    type: OrderType;
}

class InternalTradeDto {
    userId: string;
    @IsNumber()
    @IsPositive()
    assetAmount: number;

    @IsNumber()
    @IsPositive()
    price: number;

    @IsEnum(OrderType)
    type: OrderType;
}

class GetPricesDto {
    @IsArray()
    @IsUUID('4', { each: true })
    assetIds: string[];
}

@Controller('trade')
export class TradeController {
    constructor(private readonly tradeService: TradeService){}

    @Get('quote/:assetId')
    async getQuote(@Param('assetId', ParseUUIDPipe) assetId: string){
        return this.tradeService.getQuote(assetId);
    }

    @Post('history/:assetId')
    getHistory(@Param('assetId', ParseUUIDPipe) assetId: string){
        return this.tradeService.getHistory(assetId);
    }

    @Post('buy/:assetId')
    @UseGuards(AuthGuard('jwt'))
    buy(@Request() req,
        @Body(ValidationPipe) tradeDto: TradeDto,
        @Param('assetId', ParseUUIDPipe) assetId: string
    ){
        const userId = req.user.userId;
        const { assetAmount, price, type } = tradeDto;
        return this.tradeService.placeOrder(assetId, userId, 'BUY', type, price, assetAmount);
    }

    @Post('sell/:assetId')
    @UseGuards(AuthGuard('jwt'))
    sell(@Request() req,
        @Body(ValidationPipe) tradeDto: TradeDto,
        @Param('assetId', ParseUUIDPipe) assetId: string
    ){
        const userId = req.user.userId;
        const { assetAmount, price, type } = tradeDto;
        return this.tradeService.placeOrder(assetId, userId, 'SELL', type, price, assetAmount);
    }

    @Post('prices')
    @UseGuards(InternalApiKeyGuard)
    getPrices(@Body(ValidationPipe) getPricesDto: GetPricesDto){
        return this.tradeService.getPrices(getPricesDto.assetIds);
    }

    @Post('internal/sell/:assetId')
    @UseGuards(InternalApiKeyGuard)
    internalSell(@Body(ValidationPipe) internalDto: InternalTradeDto, @Param('assetId', ParseUUIDPipe) assetId: string){
        const { userId, assetAmount, price, type } = internalDto;
        return this.tradeService.placeOrder(assetId, userId, 'SELL', type, price, assetAmount);
    }
}