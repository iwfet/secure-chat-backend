import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { Message } from './entities/message.entity';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard) // Protege todas as rotas deste controller com autenticação JWT
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages')
  async getMessages(@Request() req): Promise<Message[]> {
    // Acessa o ID do usuário que foi adicionado ao objeto 'req' pelo JwtStrategy
    const userId = req.user.userId;

    // Retorna as mensagens destinadas ao usuário autenticado e as deleta do servidor
    return this.chatService.getAndClearMessagesForUser(userId);
  }
}