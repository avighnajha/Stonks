import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Wallet } from './entities/wallet.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Wallet]),
        JwtModule.register({
            secret: "Super_secret_key",
            signOptions: {expiresIn:"1h"}
        })
    ],
    controllers: [WalletController],
    providers: [WalletService],
})

export class WalletModule {}