import { Injectable, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {User} from './entities/user.entity'
import { CreateUserDto } from "./dto/create_user.dto";
import * as bcrypt from 'bcrypt'

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>
    ){}

    async create(CreateUserDto : CreateUserDto) {
        const {email, password} = CreateUserDto;
        const hashedPassword = await bcrypt.hash(password, 10);

        const existingUser = await this.userRepository.findOne({where: {email}})

        if (existingUser) {
            throw new ConflictException('A user with this email already exists')
        }

        const newUser = this.userRepository.create({
            email,
            password_hash: hashedPassword,
        })

        await this.userRepository.save(newUser);
        const {password_hash, ...result} = newUser;
        
        console.log(`--- New user registered: ${email} ---`);
        return result;
    }
}