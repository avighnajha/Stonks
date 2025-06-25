import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { User } from './entities/user.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        JwtModule.register({
            secret: "Super_secret_key",
            signOptions: {expiresIn:"1h"}
        })
    ],
    controllers: [UserController],
    providers: [UserService],
})

export class UserModule {}