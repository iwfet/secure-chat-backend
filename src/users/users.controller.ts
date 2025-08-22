import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { Throttle } from 'nestjs-throttler';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Throttle(10, 6000)
  @Get('search')
  searchUsers(@Query('username') username: string) {
    if (!username || username.length < 3) {
      throw new BadRequestException('O termo de pesquisa deve ter pelo menos 3 caracteres.');
    }
    return this.usersService.searchByUsername(username);
  }
}