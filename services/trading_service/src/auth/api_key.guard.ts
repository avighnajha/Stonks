import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-internal-api-key'];
    const validApiKey = process.env.INTERNAL_API_KEY || 'a-very-secret-internal-key';
    if (apiKey === validApiKey) {
      return true;
    }
    throw new UnauthorizedException('Invalid or missing internal API key');
  }
}