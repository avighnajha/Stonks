import { Controller, Get, Post, Param, UseGuards, BadRequestException, Body, Query } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  private readonly userServiceUrl = process.env.USER_SERVICE_URL || 'http://user_service:3001';
  private readonly walletServiceUrl = process.env.WALLET_SERVICE_URL || 'http://wallet_service:3002';
  private readonly portfolioServiceUrl = process.env.PORTFOLIO_SERVICE_URL || 'http://portfolio_service:3005';
  private readonly tradingServiceUrl = process.env.TRADING_SERVICE_URL || 'http://trading_service:3004';
  private readonly internalHeaders = {
    'x-internal-api-key': process.env.INTERNAL_API_KEY || 'a-very-secret-internal-key',
  };

  constructor(private readonly httpService: HttpService) {}

  private async internalGet<T>(url: string) {
    console.log(`[AdminController] Internal GET to: ${url}`);
    try {
      const response = await firstValueFrom(
        this.httpService.get<T>(url, {
          headers: this.internalHeaders,
        }),
      );
      console.log(`[AdminController] Success from: ${url}`);
      return response.data;
    } catch (error: any) {
      console.error(`[AdminController] Error from ${url}:`, error.message);
      throw error;
    }
  }

  private async internalPost<T>(url: string, payload: any) {
    const response = await firstValueFrom(
      this.httpService.post<T>(url, payload, {
        headers: this.internalHeaders,
      }),
    );
    return response.data;
  }

  @Get('market-stats')
  async marketStats() {
    return this.internalGet(`${this.tradingServiceUrl}/trade/admin/market-stats`);
  }

  @Get('order-book/:assetId')
  async orderBook(@Param('assetId') assetId: string) {
    return this.internalGet(`${this.tradingServiceUrl}/trade/admin/order-book/${assetId}`);
  }

  @Get('all-trades')
  async allTrades() {
    return this.internalGet(`${this.tradingServiceUrl}/trade/admin/all-trades`);
  }

  @Get('price-history/:assetId')
  async priceHistory(@Param('assetId') assetId: string, @Query('timeframe') timeframe?: string) {
    const url = `${this.tradingServiceUrl}/trade/history/${assetId}${timeframe ? `?timeframe=${timeframe}` : ''}`;
    return this.internalGet(url);
  }

  @Get('leaderboard')
  async leaderboard() {
    const [users, wallets, holdings] = await Promise.all([
      this.internalGet<any[]>(`${this.userServiceUrl}/auth/admin/users`),
      this.internalGet<any[]>(`${this.walletServiceUrl}/wallet/admin/all`),
      this.internalGet<any[]>(`${this.portfolioServiceUrl}/portfolio/admin/all`),
    ]);

    // Filter valid UUIDs from holdings
    const allAssetIds = holdings.map((holding) => holding.asset_id || holding.assetId);
    const assetIds = Array.from(new Set(
      allAssetIds.filter((id) => id && typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    ));

    let prices: { assetId: string; price: number }[] = [];
    if (assetIds.length > 0) {
      try {
        const pricePayload = { assetIds };
        prices = await this.internalPost<{ assetId: string; price: number }[]>(`${this.tradingServiceUrl}/trade/prices`, pricePayload);
      } catch (error: any) {
        console.error('[AdminController] Failed to fetch prices, using empty array:', error.message);
        prices = [];
      }
    }

    const priceMap = new Map(prices.map((price) => [price.assetId, Number(price.price)]));
    const walletMap = new Map(wallets.map((wallet) => [wallet.user_id || wallet.userId, Number(wallet.balance) || 0]));

    const leaderboardMap = new Map<string, any>();
    for (const user of users) {
      const id = user.id || user.userId;
      leaderboardMap.set(id, {
        userId: id,
        name: user.name || user.username || user.email,
        email: user.email,
        cash: walletMap.get(id) ?? 0,
        portfolioValue: 0,
        netWorth: 0,
      });
    }

    for (const holding of holdings) {
      const userId = holding.user_id || holding.userId;
      const quantity = Number(holding.quantity || holding.qty || 0);
      const price = priceMap.get(holding.asset_id || holding.assetId) ?? 0;
      const record = leaderboardMap.get(userId) || {
        userId,
        name: 'Unknown',
        email: '',
        cash: walletMap.get(userId) ?? 0,
        portfolioValue: 0,
        netWorth: 0,
      };
      record.portfolioValue += quantity * price;
      record.netWorth = record.cash + record.portfolioValue;
      leaderboardMap.set(userId, record);
    }

    const leaderboard = Array.from(leaderboardMap.values()).map((entry) => ({
      ...entry,
      netWorth: entry.cash + entry.portfolioValue,
    }));

    return leaderboard.sort((a, b) => b.netWorth - a.netWorth);
  }
}
