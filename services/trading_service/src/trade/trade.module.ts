import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetController } from './trade.controller';
import { AssetService } from './trade.service';
import { Asset } from './entities/liquidity_pool.entity'; // <-- Import the entity

@Module({
    imports: [
    TypeOrmModule.forFeature([Asset]) // <-- Make the Asset repository available
    ],
    controllers: [AssetController],
    providers: [AssetService],
})
export class AssetModule {}