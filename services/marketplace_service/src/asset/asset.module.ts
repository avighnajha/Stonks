import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { Asset } from './entities/asset.entity'; // <-- Import the entity

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset]) // <-- Make the Asset repository available
  ],
  controllers: [AssetController],
  providers: [AssetService],
})
export class AssetModule {}