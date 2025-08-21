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
import { UseGuards, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ContactsService } from '../contacts/contacts.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { WsJwtAuthGuard } from '../auth/guard/ws-jwt-auth.guard';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly contactsService: ContactsService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        throw new WsException('Token não fornecido.');
      }

      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findOneById(payload.sub);

      if (!user) {
        throw new WsException('Usuário não encontrado.');
      }

      client.data.user = user;

      this.logger.log(`Cliente conectado: ${client.id}, UserID: ${user.id}`);
      client.join(user.id);

      const contacts = await this.contactsService.getContacts(user.id);
      const onlinePayload = { userId: user.id, status: 'online' };
      contacts.forEach((contact) => {
        const contactId =
          contact.requester.id === user.id
            ? contact.addressee.id
            : contact.requester.id;
        this.server.to(contactId).emit('presenceUpdate', onlinePayload);
      });
    } catch (error) {
      this.logger.error(`Falha na autenticação do socket: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (!client.data.user) {
      return;
    }

    const user = client.data.user;
    this.logger.log(`Cliente desconectado: ${client.id}`);

    const contacts = await this.contactsService.getContacts(user.id);
    const offlinePayload = { userId: user.id, status: 'offline' };
    contacts.forEach((contact) => {
      const contactId =
        contact.requester.id === user.id
          ? contact.addressee.id
          : contact.requester.id;
      this.server.to(contactId).emit('presenceUpdate', offlinePayload);
    });
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const fromUserId = client.data.user.id;
    const message = await this.chatService.createMessage(
      fromUserId,
      createMessageDto,
    );
    this.server.to(createMessageDto.toUserId).emit('newMessage', message);
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('messageRead')
  async handleMessageRead(
    @MessageBody() data: { messageId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = client.data.user.id;
    const { messageId } = data;

    const message = await this.chatService.findMessageById(messageId);
    if (!message || message.toUser.id !== userId) {
      return;
    }

    await this.chatService.markMessageAsRead(messageId);

    setTimeout(() => {
      this.chatService.deleteMessage(messageId);
    }, 30000);

    this.server
      .to(message.fromUser.id)
      .emit('messageStatusUpdate', { messageId, status: 'read' });
  }
}