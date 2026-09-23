import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TradeModule } from './trade/trade.module';
import { RedisModule } from './redis/redis.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './auth/jwt.strategy';
import { ConfigModule } from '@nestjs/config';
import { AtomicExchange1790101000000 } from './exchange/schema';

@Module({
  imports: [
    TradeModule,
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      // Reads the connection string set in docker comp
      url: process.env.DATABASE_URL,
      // Load any entity files.
      autoLoadEntities: true,
      // auto create tables depending on entities
      synchronize: false,
      migrations: [AtomicExchange1790101000000],
      migrationsRun: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule {}
