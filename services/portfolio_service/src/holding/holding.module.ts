import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HoldingController } from './holding.controller';
import { HoldingService } from './holding.service';
import { Holding } from './entities/holding.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Holding])
  ],
  controllers: [HoldingController],
  providers: [HoldingService],
})
export class HoldingModule {}