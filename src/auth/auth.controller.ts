import { Controller, Post, Request, UseGuards, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { LocalAuthGuard } from './guard/local-auth.guard';
import { Throttle } from 'nestjs-throttler';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Throttle(  5,  60000  )
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    const saltRounds = 17;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);
    return this.usersService.create({
      username: createUserDto.username,
      password: hashedPassword,
    });
  }
}