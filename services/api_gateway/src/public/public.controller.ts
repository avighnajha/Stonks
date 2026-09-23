import { Controller, Get, Post, Request, Response } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Controller()
export class PublicController {
  constructor(private readonly http: HttpService) {}
  private async forward(base: string | undefined, req: any, res: any) {
    try {
      const response = await firstValueFrom(
        this.http.request({
          method: req.method,
          url: `${base}${req.originalUrl}`,
          data: req.body,
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }),
      );
      res.status(response.status).json(response.data);
    } catch (e) {
      res
        .status(e.response?.status || 502)
        .json(e.response?.data || { message: 'Service unavailable' });
    }
  }
  @Post(['auth/register', 'auth/login'])
  auth(@Request() req, @Response() res) {
    return this.forward(process.env.USER_SERVICE_URL, req, res);
  }
  @Get(['assets/approved', 'assets/:id'])
  assets(@Request() req, @Response() res) {
    // /assets/all is admin-only and must retain the bearer token.
    if (req.params.id === 'all')
      return res
        .status(404)
        .json({ message: 'Use the authenticated admin assets endpoint' });
    return this.forward(process.env.MARKETPLACE_SERVICE_URL, req, res);
  }
  @Get(['trade/markets', 'trade/quote/:assetId', 'trade/history/:assetId'])
  data(@Request() req, @Response() res) {
    return this.forward(process.env.TRADING_SERVICE_URL, req, res);
  }
}
