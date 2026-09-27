import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  BadRequestException,
  HttpException,
  Body,
  Query,
  Headers,
  Request,
} from '@nestjs/common';
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
  private readonly base =
    process.env.TRADING_SERVICE_URL || 'http://trading_service:3004';
  private readonly headers = {
    'x-internal-api-key': process.env.INTERNAL_API_KEY!,
  };
  constructor(private readonly http: HttpService) {}
  private async get(route: string) {
    try {
      return (
        await firstValueFrom(
          this.http.get(this.base + route, {
            headers: this.headers,
            timeout: 15000,
          }),
        )
      ).data;
    } catch (e) {
      throw new HttpException(
        e.response?.data || 'Service unavailable',
        e.response?.status || 502,
      );
    }
  }
  @Get('market-stats')
  stats() {
    return this.get('/trade/admin/market-stats');
  }
  @Get('order-book/:assetId')
  book(@Param('assetId') id: string) {
    return this.get(`/trade/admin/order-book/${id}`);
  }
  @Get('all-trades')
  trades() {
    return this.get('/trade/admin/all-trades');
  }
  @Get('price-history/:assetId')
  history(
    @Param('assetId') id: string,
    @Query('timeframe') timeframe?: string,
  ) {
    return this.get(
      `/trade/history/${id}${timeframe ? '?timeframe=' + encodeURIComponent(timeframe) : ''}`,
    );
  }
  @Get('leaderboard')
  leaderboard() {
    return this.get('/trade/admin/leaderboard');
  }
  @Post('inject-news')
  async news(
    @Request() req,
    @Headers('idempotency-key') key: string,
    @Body() body: { assetId: string; headline: string; sentiment: number },
  ) {
    if (!/^[0-9a-f-]{36}$/i.test(body.assetId || ''))
      throw new BadRequestException('Invalid asset ID');
    try {
      return (
        await firstValueFrom(
          this.http.post(
            `${this.base}/trade/internal/news/${body.assetId}`,
            {
              adminUserId: req.user.userId,
              headline: body.headline,
              sentiment: body.sentiment,
            },
            {
              headers: { ...this.headers, 'idempotency-key': key },
              timeout: 15000,
            },
          ),
        )
      ).data;
    } catch (e) {
      throw new HttpException(
        e.response?.data || 'News outcome unavailable; retry unchanged request',
        e.response?.status || 502,
      );
    }
  }
}
