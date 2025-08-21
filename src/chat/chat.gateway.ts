
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { WsJwtAuthGuard } from '../auth/guard/ws-jwt-auth.guard';

@UseGuards(WsJwtAuthGuard) // Protege todo o gateway com nosso guard JWT para WebSockets
@WebSocketGateway({
  cors: {
    origin: '*', // Em produção, restrinja para o domínio do seu frontend!
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  // Este método é chamado quando um cliente se conecta
  handleConnection(client: Socket) {
    // O WsJwtAuthGuard já validou o token e anexou o usuário em 'client.data.user'
    this.logger.log(`Cliente conectado: ${client.id}, UserID: ${client.data.user.id}`);

    // Adiciona o cliente a uma "sala" privada com seu próprio ID de usuário.
    // Isso nos permite enviar mensagens direcionadas apenas para ele.
    client.join(client.data.user.id);
  }

  // Este método é chamado quando um cliente se desconecta
  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    // Pegamos o ID do remetente diretamente do socket autenticado para evitar falsificação (IDOR)
    const fromUserId = client.data.user.id;

    // 1. Salva a mensagem criptografada no banco de dados
    const message = await this.chatService.createMessage(
      fromUserId,
      createMessageDto,
    );

    // 2. Envia a mensagem em tempo real para o destinatário (se ele estiver online)
    // O evento é emitido apenas para a "sala" do destinatário.
    this.server.to(createMessageDto.toUserId).emit('newMessage', message);
  }
}