import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config'; // <-- IMPORT THIS

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // Inject the ConfigService into the constructor
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: any) {
    // This part is unchanged
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
