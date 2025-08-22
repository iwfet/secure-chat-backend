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
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { WsJwtAuthGuard } from '../auth/guard/ws-jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { ContactsService } from '../contacts/contacts.service';

interface OnlineUserData {
  socketId: string;
  publicKey: string;
}

interface OnlineContactPayload {
  userId: string;
  status: 'online';
  publicKey: string;
  socketId: string;
}

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly usersService: UsersService,
    private readonly contactsService: ContactsService,
    private readonly jwtService: JwtService,
  ) {}

  private getKeyForUser(userId: string): string {
    return `online_user:${userId}`;
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const publicKey = client.handshake.auth.publicKey;
      if (!token || !publicKey)
        throw new WsException('Token ou chave pública não fornecidos.');

      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findOneById(payload.sub);
      if (!user) throw new WsException('Utilizador não encontrado.');

      client.data.user = user;
      const userData: OnlineUserData = { socketId: client.id, publicKey };
      await this.cacheManager.set(this.getKeyForUser(user.id), userData);
      this.logger.log(`Cliente conectado: ${client.id}, UserID: ${user.id}`);

      const contacts = await this.contactsService.getContacts(user.id);

      const onlinePayload = {
        userId: user.id,
        status: 'online' as const,
        publicKey,
        socketId: client.id,
      };
      for (const contact of contacts) {
        const contactId =
          contact.requester.id === user.id
            ? contact.addressee.id
            : contact.requester.id;
        const contactData = await this.cacheManager.get<OnlineUserData>(
          this.getKeyForUser(contactId),
        );
        if (contactData) {
          this.server
            .to(contactData.socketId)
            .emit('presenceUpdate', onlinePayload);
        }
      }

      const onlineContacts: OnlineContactPayload[] = [];
      for (const contact of contacts) {
        const contactId =
          contact.requester.id === user.id
            ? contact.addressee.id
            : contact.requester.id;
        const contactData = await this.cacheManager.get<OnlineUserData>(
          this.getKeyForUser(contactId),
        );
        if (contactData) {
          onlineContacts.push({
            userId: contactId,
            status: 'online',
            publicKey: contactData.publicKey,
            socketId: contactData.socketId,
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

    await this.cacheManager.del(this.getKeyForUser(user.id));
    this.logger.log(`Cliente desconectado: ${client.id}`);

    const contacts = await this.contactsService.getContacts(user.id);
    const offlinePayload = { userId: user.id, status: 'offline' };
    for (const contact of contacts) {
      const contactId =
        contact.requester.id === user.id
          ? contact.addressee.id
          : contact.requester.id;
      const contactData = await this.cacheManager.get<OnlineUserData>(
        this.getKeyForUser(contactId),
      );
      if (contactData) {
        this.server
          .to(contactData.socketId)
          .emit('presenceUpdate', offlinePayload);
      }
    }
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const isRecipientOnline = this.server.sockets.sockets.has(
      createMessageDto.toSocketId,
    );

    if (isRecipientOnline) {
      const fromUser = client.data.user as User;
      const messagePayload = {
        fromUserId: fromUser.id,
        encryptedContent: createMessageDto.encryptedContent,
        createdAt: new Date(),
      };
      this.server
        .to(createMessageDto.toSocketId)
        .emit('newMessage', messagePayload);
    } else {
      client.emit('sendMessageError', {
        message: 'O destinatário ficou offline ou a conexão é inválida.',
        toSocketId: createMessageDto.toSocketId,
      });
    }
  }

  async sendContactRequest(addresseeId: string, request: Contact) {
    const userData = await this.cacheManager.get<OnlineUserData>(
      this.getKeyForUser(addresseeId),
    );
    if (userData) {
      this.server.to(userData.socketId).emit('newContactRequest', request);
    }
  }

  async notifyNewContact(contactEntity: Contact) {
    if (!contactEntity || !contactEntity.requester || !contactEntity.addressee) {
      this.logger.error('Tentativa de notificar novo contato com entidade inválida.');
      return;
    }

    const user1 = contactEntity.requester;
    const user2 = contactEntity.addressee;

    const user1Data = await this.cacheManager.get<OnlineUserData>(
      this.getKeyForUser(user1.id),
    );
    const user2Data = await this.cacheManager.get<OnlineUserData>(
      this.getKeyForUser(user2.id),
    );

    const cleanContactPayload = {
      id: contactEntity.id,
      status: contactEntity.status,
      requester: { id: user1.id, username: user1.username },
      addressee: { id: user2.id, username: user2.username },
    };

    if (user1Data) {
      const payloadForUser1 = {
        contact: cleanContactPayload,
        isOnline: !!user2Data,
        publicKey: user2Data?.publicKey,
        socketId: user2Data?.socketId,
      };
      this.server.to(user1Data.socketId).emit('newContactAccepted', payloadForUser1);
    }

    if (user2Data) {
      const payloadForUser2 = {
        contact: cleanContactPayload,
        isOnline: !!user1Data,
        publicKey: user1Data?.publicKey,
        socketId: user1Data?.socketId,
      };
      this.server.to(user2Data.socketId).emit('newContactAccepted', payloadForUser2);
    }
  }
}