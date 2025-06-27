import { Injectable, ConflictException, UnauthorizedException, HttpServer, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {User} from './entities/user.entity'
import { CreateUserDto } from "./dto/create_user.dto";
import { LoginUserDTO } from "./dto/login_user.dto";
import * as bcrypt from 'bcrypt'
import { JwtService } from "@nestjs/jwt";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly httpService: HttpService,
    ){}

    async create(createUserDto : CreateUserDto) {
        const {email, password, username} = createUserDto;
        const hashedPassword = await bcrypt.hash(password, 10);

        const existingUser = await this.userRepository.findOne({where: [{email}, {username}]})

        if (existingUser) {
            throw new ConflictException('A user with this email already exists')
        }

        const newUser = this.userRepository.create({
            email,
            password_hash: hashedPassword,
            username
        })

        await this.userRepository.save(newUser);

        try {
            this.logger.log(`Attempting to create wallet for user ${newUser.id}...`);
            // We make a POST request to the wallet-service's new endpoint.
            // The hostname 'wallet_service' is resolved by Docker's internal network.
            const walletServiceUrl = 'http://wallet_service:3002/wallet';
            
            await firstValueFrom(
                this.httpService.post(walletServiceUrl, { userId: newUser.id })
            );

            this.logger.log(`Wallet created successfully for user ${newUser.id}`);
            } catch (error) {
            this.logger.error(`Failed to create wallet for user ${newUser.id}`, error.stack);
        }

        const {password_hash, ...result} = newUser;
        
        console.log(`--- New user registered: ${email} ---`);
        return result;
    }
    async login(loginUserDto: LoginUserDTO){
        const {email, password} = loginUserDto;
        const foundUser = await this.userRepository.findOne({where:{email}});
        if (!foundUser){
            throw new UnauthorizedException("Invalid login details");
        }
        const passMatch = bcrypt.compare(password, foundUser.password_hash) 
        if (!passMatch){
            throw new UnauthorizedException("Invalid login details");
        }
        const payload = {email: foundUser.email, sub: foundUser.id}
        return {
            access_token: this.jwtService.sign(payload)
        };
    }
}