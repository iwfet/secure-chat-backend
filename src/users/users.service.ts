import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const existingUser = await this.findOneByUsername(createUserDto.username);
    if (existingUser) {
      throw new ConflictException('usuário/senha ja existe.');
    }
    const user = this.usersRepository.create(createUserDto);
    const savedUser = await this.usersRepository.save(user);
    const { password, ...result } = savedUser;
    return result;
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ username });
  }

  async findOneById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async searchByUsername(
    username: string,
  ): Promise<Pick<User, 'id' | 'username'>[]> {
    if (!username || username.length < 3) {
      return [];
    }

    const users = await this.usersRepository.find({
      where: {
        username: Like(`%${username}%`),
      },
      select: ['id', 'username'],
      take: 10,
    });
    return users;
  }
}