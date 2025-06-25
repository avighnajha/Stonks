import {Controller, Post, Body, Get, ValidationPipe, HttpCode, HttpStatus} from '@nestjs/common'
import {UserService} from './user.service';
import { CreateUserDto } from './dto/create_user.dto';
import { LoginUserDTO } from './dto/login_user.dto';

@Controller('auth')
export class UserController {
    constructor(private readonly userService: UserService){}

    @Post('register')
    register(@Body(ValidationPipe) createUserDto: CreateUserDto){
        console.log("Regitering User")
        return this.userService.create(createUserDto)
    }

    @Get('login')
    @HttpCode(HttpStatus.OK)
    login(@Body(ValidationPipe) loginUserDto: LoginUserDTO){
        console.log("User logging in")
        return this.userService.login(loginUserDto)
    }

}