import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { Asset } from './entities/asset.entity'; // <-- Import the entity
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset]),
    HttpModule
  ],
  controllers: [AssetController],
  providers: [AssetService],
})
export class AssetModule {}