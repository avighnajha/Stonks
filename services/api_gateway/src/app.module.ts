import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // <-- IMPORT THIS
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ProxyController } from './proxy/proxy.controller';
import { PublicController } from './public/public.controller';
import { AdminController } from './admin/admin.controller';
import { JwtStrategy } from './auth/jwt.strategy';
import { TradingGateway } from './trading/trading.gateway';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), 
    HttpModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '1h' },
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [
    PublicController,
    AdminController,
    ProxyController,
  ],
  providers: [JwtStrategy, TradingGateway, RolesGuard],
})
export class AppModule {}