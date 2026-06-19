import {Controller, Post, Body, Get, ValidationPipe, HttpCode, HttpStatus, Logger} from '@nestjs/common'
import {UserService} from './user.service';
import { CreateUserDto } from './dto/create_user.dto';
import { LoginUserDTO } from './dto/login_user.dto';

@Controller('auth')
export class UserController {
    private readonly logger = new Logger(UserController.name);
    constructor(private readonly userService: UserService){}

    @Post('register')
    register(@Body(ValidationPipe) createUserDto: CreateUserDto){
        this.logger.log('Registering User')
        return this.userService.create(createUserDto)
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body(ValidationPipe) loginUserDto: LoginUserDTO){
        this.logger.log('User logging in')
        return this.userService.login(loginUserDto)
    }
}