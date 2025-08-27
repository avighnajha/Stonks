import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // <-- IMPORT THIS
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';
import { ProxyController } from './proxy/proxy.controller';
import { PublicController } from './public/public.controller';
import { JwtStrategy } from './auth/jwt.strategy';

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
  providers: [JwtStrategy],
})
export class AppModule {}