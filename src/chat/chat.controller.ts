import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { Message } from './entities/message.entity';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages')
  async getMessages(@Request() req): Promise<Message[]> {
    const userId = req.user.userId;
    return this.chatService.getUnreadMessagesForUser(userId);
  }
}