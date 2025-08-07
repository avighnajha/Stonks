import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TradeModule } from './trade/trade.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [TradeModule,
          PassportModule.register({defaultStrategy: 'jwt'}),
          TypeOrmModule.forRoot({
                type: 'postgres',
                // Reads the connection string set in docker comp
                url: process.env.DATABASE_URL,
                // Load any entity files.
                autoLoadEntities: true,
                // auto create tables depending on entities
                synchronize: true,})

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
