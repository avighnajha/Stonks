import {Controller, Post, Body, Get, ValidationPipe} from '@nestjs/common'
import {UserService} from './user.service';
import { CreateUserDto } from './dto/create_user.dto';

@Controller('auth')
export class UserController {
    constructor(private readonly userService: UserService){}

    @Post('register')
    register(@Body(ValidationPipe) createUserDto: CreateUserDto){
        console.log("In register")
        return this.userService.create(createUserDto)
    }

}