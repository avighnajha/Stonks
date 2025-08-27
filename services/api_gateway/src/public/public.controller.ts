import { Controller, Post, Get, Request, Response } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// This controller now handles both /auth and /assets prefixes
@Controller(['auth', 'assets'])
export class PublicController {
  constructor(private readonly httpService: HttpService) {}

  // Handles POST /auth/register and POST /auth/login
  @Post(['/register', '/login'])
  async authRequest(@Request() req, @Response() res) {
    const { method, originalUrl, headers, body } = req;
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url: `${process.env.USER_SERVICE_URL}${originalUrl}`,
          headers: { 'Content-Type': headers['content-type'] || 'application/json' },
          data: body,
        }),
      );
      res.status(response.status).json(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).json(error.response?.data || 'Internal server error');
    }
  }

  // Handles GET /assets and GET /assets/:id
  @Get(['/', '/:id'])
  async assetRequest(@Request() req, @Response() res) {
    const { method, originalUrl, headers, body } = req;
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url: `${process.env.MARKETPLACE_SERVICE_URL}${originalUrl}`,
          headers: { 'Content-Type': headers['content-type'] || 'application/json' },
          data: body,
        }),
      );
      res.status(response.status).json(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).json(error.response?.data || 'Internal server error');
    }
  }
}