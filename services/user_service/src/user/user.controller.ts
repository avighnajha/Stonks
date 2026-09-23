import { JwtGuard } from './jwt.guard';
import {
  Controller,
  Post,
  Body,
  Get,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create_user.dto';
import { LoginUserDTO } from './dto/login_user.dto';
import { InternalApiKeyGuard } from '../auth/api_key.guard';

@Controller('auth')
export class UserController {
  private readonly logger = new Logger(UserController.name);
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(JwtGuard)
  me(@Request() req) {
    return this.userService.me(req.user.userId);
  }

  @Post('logout')
  @UseGuards(JwtGuard)
  logout() {
    return { message: 'Remove the bearer token on the client' };
  }

  @Post('register')
  register(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    this.logger.log('Registering User');
    return this.userService.create(createUserDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(ValidationPipe) loginUserDto: LoginUserDTO) {
    this.logger.log('User logging in');
    return this.userService.login(loginUserDto);
  }

  @Get('admin/users')
  @UseGuards(InternalApiKeyGuard)
  async getAdminUsers() {
    return this.userService.getAllUsers();
  }

  @Post('admin/make-admin')
  @UseGuards(InternalApiKeyGuard)
  async makeAdmin(@Body() body: { email: string }) {
    return this.userService.makeUserAdmin(body.email);
  }
}
