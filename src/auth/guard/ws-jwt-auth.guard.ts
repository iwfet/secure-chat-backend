import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const token = client.handshake.auth.token;

      if (!token) {
        throw new WsException('Token não fornecido.');
      }

      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findOneById(payload.sub);

      if (!user) {
        throw new WsException('Usuário não encontrado.');
      }

      // Anexa o usuário ao objeto do socket para uso posterior
      client.data.user = user;
      return true;

    } catch (err) {
      throw new WsException('Token inválido.');
    }
  }
}