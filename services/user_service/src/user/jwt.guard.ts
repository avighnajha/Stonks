import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    try {
      const header = request.headers.authorization || '';
      if (!header.startsWith('Bearer ')) throw new Error();
      const payload = this.jwt.verify(header.slice(7));
      if (!/^[0-9a-f-]{36}$/i.test(payload.sub || '')) throw new Error();
      request.user = { userId: payload.sub, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
