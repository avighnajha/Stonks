import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // <-- IMPORT THIS
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';
import { ProxyController } from './proxy/proxy.controller';
import { PublicController } from './public/public.controller';
import { JwtStrategy } from './auth/jwt.strategy';
import { TradingGateway } from './trading/trading.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), 
    HttpModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [
    PublicController,
    ProxyController,
  ],
  providers: [JwtStrategy, TradingGateway],
})
export class AppModule {}