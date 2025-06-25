import { Injectable, ConflictException, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {User} from './entities/user.entity'
import { CreateUserDto } from "./dto/create_user.dto";
import { LoginUserDTO } from "./dto/login_user.dto";
import * as bcrypt from 'bcrypt'
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
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