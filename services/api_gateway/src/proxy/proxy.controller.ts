import { Controller, All, Request, Response, UseGuards } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '@nestjs/passport';

@Controller()
export class ProxyController {
  constructor(private readonly httpService: HttpService) {}

  // @All('*') is a catch-all that intercepts every single request
  // that comes into the gateway, regardless of method (GET, POST, etc.)
  @All('*')
  @UseGuards(AuthGuard('jwt'))
  async proxyRequest(@Request() req, @Response() res) {
    const recipientServiceUrl = this.getRecipientServiceUrl(req.originalUrl);

    if (!recipientServiceUrl) {
      return res.status(502).json({ message: 'Cannot process request: service not found' });
    }

    const { method, originalUrl, headers, body } = req;
    
    // Forward the user's JWT and other important headers
    const forwardedHeaders = {
      'Content-Type': headers['content-type'] || 'application/json',
      'Authorization': headers['authorization'],
    };

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url: `${recipientServiceUrl}${originalUrl}`,
          headers: forwardedHeaders,
          data: body,
        }),
      );
      res.status(response.status).json(response.data);
    } catch (error) {
      res.status(error.response?.status || 500).json(error.response?.data || 'Internal server error');
    }
  }

  // This helper function determines where to send the request.
  private getRecipientServiceUrl(url: string): string | null {
    if (url.startsWith('/auth')) {
      return process.env.USER_SERVICE_URL!;
    }
    if (url.startsWith('/wallet')) {
      return process.env.WALLET_SERVICE_URL!;
    }
    if (url.startsWith('/assets')) {
      return process.env.MARKETPLACE_SERVICE_URL!;
    }
    if (url.startsWith('/trade')) {
      return process.env.TRADING_SERVICE_URL!;
    }
    if (url.startsWith('/portfolio')) {
      return process.env.PORTFOLIO_SERVICE_URL!;
    }
    return null;
  }
}