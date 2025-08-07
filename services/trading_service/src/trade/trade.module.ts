import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';
import { LiquidityPool } from './entities/liquidity_pool.entity'; // <-- Import the entity
import { HttpModule } from '@nestjs/axios';

@Module({
    imports: [
    TypeOrmModule.forFeature([LiquidityPool]),
    HttpModule
    ],
    controllers: [TradeController],
    providers: [TradeService],
})
export class TradeModule {}