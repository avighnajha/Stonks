import { ExchangeService } from '../exchange/exchange.service';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { TradeService } from './trade.service';
import { AuthGuard } from '@nestjs/passport';
import {
  IsArray,
  IsDefined,
  IsEnum,
  IsNumber,
  IsPositive,
  IsUUID,
} from 'class-validator';
import { InternalApiKeyGuard } from '../auth/api_key.guard';
import { OrderType } from './entities/order.entity';

class TradeDto {
  @IsDefined()
  assetAmount: string | number;

  @IsDefined()
  price: string | number;

  @IsEnum(OrderType)
  type: OrderType;
}

class InternalTradeDto {
  userId: string;
  @IsDefined()
  assetAmount: string | number;

  @IsDefined()
  price: string | number;

  @IsEnum(OrderType)
  type: OrderType;
}

class CreatePoolDto {
  @IsUUID('4')
  assetId: string;
}

class GetPricesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  assetIds: string[];
}

@Controller('trade')
export class TradeController {
  constructor(
    private readonly tradeService: TradeService,
    private readonly exchange: ExchangeService,
  ) {}

  @Get('orders')
  @UseGuards(AuthGuard('jwt'))
  orders(@Request() req, @Query('before') before?: string) {
    return this.exchange.orders(req.user.userId, before);
  }

  @Get('account')
  @UseGuards(AuthGuard('jwt'))
  account(@Request() req) {
    return this.exchange.account(req.user.userId);
  }

  @Get('fills')
  @UseGuards(AuthGuard('jwt'))
  fills(@Request() req, @Query('after') after = '0') {
    return this.exchange.fills(req.user.userId, after);
  }

  @Get('admin/leaderboard')
  @UseGuards(InternalApiKeyGuard)
  leaderboard() {
    return this.exchange.leaderboard();
  }

  @Post('internal/news/:assetId')
  @UseGuards(InternalApiKeyGuard)
  news(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Headers('idempotency-key') key: string,
    @Body() body: { adminUserId: string; headline: string; sentiment: number },
  ) {
    return this.exchange.news(body.adminUserId, key, {
      assetId,
      headline: body.headline,
      sentiment: body.sentiment,
    });
  }

  @Get('order/:orderId')
  @UseGuards(AuthGuard('jwt'))
  order(@Request() req, @Param('orderId', ParseUUIDPipe) id: string) {
    return this.exchange.order(req.user.userId, id);
  }

  @Get('book/:assetId')
  @UseGuards(AuthGuard('jwt'))
  book(@Param('assetId', ParseUUIDPipe) id: string) {
    return this.exchange.snapshot(id);
  }

  @Get('events')
  @UseGuards(AuthGuard('jwt'))
  events(@Query('after') after = '0') {
    return this.exchange.events(after);
  }

  @Get('feed-snapshot')
  @UseGuards(AuthGuard('jwt'))
  feedSnapshot() {
    return this.exchange.feedSnapshot();
  }

  @Post('internal/issue/:assetId')
  @UseGuards(InternalApiKeyGuard)
  issue(
    @Param('assetId', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string,
    @Body()
    body: {
      adminUserId: string;
      initialPrice: number;
      totalSupply: number;
      creatorPercentage: number;
    },
  ) {
    if (!/^[0-9a-f-]{36}$/i.test(body.adminUserId || ''))
      throw new BadRequestException('Invalid administrator ID');
    return this.exchange.issue(
      body.adminUserId,
      key,
      id,
      body.initialPrice,
      body.totalSupply,
      body.creatorPercentage,
    );
  }

  @Get('markets')
  markets() {
    return this.tradeService.markets();
  }

  @Get('quote/:assetId')
  async getQuote(@Param('assetId', ParseUUIDPipe) assetId: string) {
    return this.tradeService.getQuote(assetId);
  }

  @Get('history/:assetId')
  getHistory(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Query('timeframe') timeframe?: string,
    @Query('days') days?: string,
  ) {
    return this.tradeService.getHistory(
      assetId,
      timeframe,
      days !== undefined ? Number(days) : undefined,
    );
  }

  @Post('buy/:assetId')
  @UseGuards(AuthGuard('jwt'))
  buy(
    @Request() req,
    @Headers('idempotency-key') key: string,
    @Body(ValidationPipe) tradeDto: TradeDto,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ) {
    const userId = req.user.userId;
    const { assetAmount, price, type } = tradeDto;
    return this.exchange.place(userId, key, {
      assetId,
      side: 'BUY',
      type,
      price,
      quantity: assetAmount,
    });
  }

  @Post('sell/:assetId')
  @UseGuards(AuthGuard('jwt'))
  sell(
    @Request() req,
    @Headers('idempotency-key') key: string,
    @Body(ValidationPipe) tradeDto: TradeDto,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ) {
    const userId = req.user.userId;
    const { assetAmount, price, type } = tradeDto;
    return this.exchange.place(userId, key, {
      assetId,
      side: 'SELL',
      type,
      price,
      quantity: assetAmount,
    });
  }

  @Post('prices')
  @UseGuards(InternalApiKeyGuard)
  getPrices(@Body(ValidationPipe) getPricesDto: GetPricesDto) {
    return this.tradeService.getPrices(getPricesDto.assetIds);
  }

  @Get('admin/market-stats')
  @UseGuards(InternalApiKeyGuard)
  async getAdminMarketStats() {
    return this.tradeService.getMarketStats();
  }

  @Get('admin/all-trades')
  @UseGuards(InternalApiKeyGuard)
  async getAdminAllTrades() {
    return this.tradeService.getAllTrades();
  }

  @Get('admin/order-book/:assetId')
  @UseGuards(InternalApiKeyGuard)
  async getAdminOrderBook(@Param('assetId', ParseUUIDPipe) assetId: string) {
    return this.tradeService.getOrderBookSnapshot(assetId);
  }

  @Delete('order/:orderId')
  @UseGuards(AuthGuard('jwt'))
  async cancelOrder(
    @Request() req,
    @Headers('idempotency-key') key: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    const userId = req.user.userId;
    return this.exchange.cancel(userId, key, orderId);
  }
}
