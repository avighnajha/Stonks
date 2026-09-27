import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  HttpServer,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create_user.dto';
import { LoginUserDTO } from './dto/login_user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { email, password, username } = createUserDto;
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await this.userRepository.findOne({
      where: [{ email }, { username }],
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const newUser = this.userRepository.create({
      email,
      password_hash: hashedPassword,
      username,
    });

    await this.userRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [73190421]);
      await manager.save(newUser);
      await manager.query(
        'INSERT INTO wallets(user_id,balance) VALUES($1,10000)',
        [newUser.id],
      );
      await manager.query(
        "INSERT INTO exchange_ledger(user_id,reason,available_delta,reserved_delta) VALUES($1,'endowment',10000,0)",
        [newUser.id],
      );
    });
    const { password_hash, ...result } = newUser;

    this.logger.log(`--- New user registered: ${email} ---`);

    // Generate token for new user
    const payload = {
      email: newUser.email,
      sub: newUser.id,
      role: newUser.role,
    };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.username,
        balance: 0,
        role: newUser.role,
      },
    };
  }

  async me(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'email', 'username', 'role'],
    });
    if (!user) throw new UnauthorizedException();
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.username,
        role: user.role,
      },
    };
  }

  async getAllUsers() {
    return this.userRepository.find({
      select: ['id', 'email', 'username', 'role'],
    });
  }

  async makeUserAdmin(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    user.role = 'admin';
    await this.userRepository.save(user);
    this.logger.log(`User ${email} promoted to admin`);
    return { message: 'User promoted to admin', email, role: user.role };
  }

  async login(loginUserDto: LoginUserDTO) {
    const { email, password } = loginUserDto;
    const foundUser = await this.userRepository.findOne({ where: { email } });
    if (!foundUser) {
      throw new UnauthorizedException('Invalid login details');
    }
    const passMatch = await bcrypt.compare(password, foundUser.password_hash);
    if (!passMatch) {
      throw new UnauthorizedException('Invalid login details');
    }
    this.logger.log(`Logging in user with role ${foundUser.role}`);
    //jwt payload checked when logging in
    const payload = {
      email: foundUser.email,
      sub: foundUser.id,
      role: foundUser.role,
    };
    return {
      token: this.jwtService.sign(payload),
      user: {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.username,
        balance: 0,
        role: foundUser.role,
      },
    };
  }
}
