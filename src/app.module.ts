// Documentação: Este é o módulo raiz. Ele junta todos os outros módulos
// e configura as conexões globais, como a com o banco de dados.

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { User } from './users/entities/user.entity';
import { Message } from './chat/entities/message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDev= configService.get('NODE_ENV') !== 'production'
        return {
          type: 'postgres',
            host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          entities: [User, Message],
          synchronize: isDev,
          logging: isDev,
          retryAttempts: 3,
          parseInt8: true,
          poolSize: configService.get<number>('DB_POOL_MAX', 50),
        }
      },
    }),
    AuthModule,
    UsersModule,
    ChatModule,
  ],
})
export class AppModule {}