import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER,Cache } from '@nestjs/cache-manager';

import { CreateMessageDto } from './dto/create-message.dto';
import { ContactsService } from '../contacts/contacts.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { WsJwtAuthGuard } from '../auth/guard/ws-jwt-auth.guard';
import { User } from 'src/users/entities/user.entity';

interface OnlineUserData {
  socketId: string;
  publicKey: string;
}


interface OnlineContactPayload {
  userId: string;
  status: 'online';
  publicKey: string;
}

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly contactsService: ContactsService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  private getKeyForUser(userId: string): string {
    return `online_user:${userId}`;
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const publicKey = client.handshake.auth.publicKey;

      if (!token || !publicKey) {
        throw new WsException('Token ou chave pública não fornecidos.');
      }

      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findOneById(payload.sub);
      if (!user) throw new WsException('Usuário não encontrado.');

      client.data.user = user;
      const userData: OnlineUserData = { socketId: client.id, publicKey };

      // Armazena os dados do usuário no Redis
      await this.cacheManager.set(this.getKeyForUser(user.id), userData);

      this.logger.log(`Cliente conectado: ${client.id}, UserID: ${user.id}`);

      const contacts = await this.contactsService.getContacts(user.id);

      // Notifica os contatos que o usuário está online
      const onlinePayload = { userId: user.id, status: 'online', publicKey };
      for (const contact of contacts) {
        const contactId = contact.requester.id === user.id ? contact.addressee.id : contact.requester.id;
        const contactData = await this.cacheManager.get<OnlineUserData>(this.getKeyForUser(contactId));
        if (contactData) {
          this.server.to(contactData.socketId).emit('presenceUpdate', onlinePayload);
        }
      }

      // Envia para o usuário recém-conectado os contatos que já estão online
      const onlineContacts: OnlineContactPayload[] = [];
      for (const contact of contacts) {
        const contactId = contact.requester.id === user.id ? contact.addressee.id : contact.requester.id;
        const contactData = await this.cacheManager.get<OnlineUserData>(this.getKeyForUser(contactId));
        if (contactData) {
          onlineContacts.push({
            userId: contactId,
            status: 'online',
            publicKey: contactData.publicKey,
          });
        }
      }
      client.emit('onlineContacts', onlineContacts);

    } catch (error) {
      this.logger.error(`Falha na autenticação do socket: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (!client.data.user) return;
    const user = client.data.user as User;

    // Remove o usuário do Redis
    await this.cacheManager.del(this.getKeyForUser(user.id));
    this.logger.log(`Cliente desconectado: ${client.id}`);

    const contacts = await this.contactsService.getContacts(user.id);
    const offlinePayload = { userId: user.id, status: 'offline' };

    // Notifica os contatos que o usuário ficou offline
    for (const contact of contacts) {
      const contactId = contact.requester.id === user.id ? contact.addressee.id : contact.requester.id;
      const contactData = await this.cacheManager.get<OnlineUserData>(this.getKeyForUser(contactId));
      if (contactData) {
        this.server.to(contactData.socketId).emit('presenceUpdate', offlinePayload);
      }
    }
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const fromUser = client.data.user as User;

    // Busca o destinatário no Redis para ver se está online
    const toUserData = await this.cacheManager.get<OnlineUserData>(this.getKeyForUser(createMessageDto.toUserId));

    if (toUserData) {
      // Se estiver online, encaminha a mensagem diretamente para o socket dele
      const messagePayload = {
        fromUserId: fromUser.id,
        encryptedContent: createMessageDto.encryptedContent,
        createdAt: new Date(),
      };
      this.server.to(toUserData.socketId).emit('newMessage', messagePayload);
    } else {
      client.emit('sendMessageError', {
        message: 'O destinatário não está online.',
        toUserId: createMessageDto.toUserId,
      });
    }
  }
}