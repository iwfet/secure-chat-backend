import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly usersService: UsersService,
  ) {}

  async createMessage(
    fromUserId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<Message> {
    const fromUser = await this.usersService.findOneById(fromUserId);
    const toUser = await this.usersService.findOneById(
      createMessageDto.toUserId,
    );

    if (!fromUser || !toUser) {
      throw new NotFoundException('Usuário remetente ou destinatário não encontrado.');
    }

    const newMessage = this.messagesRepository.create({
      fromUser,
      toUser,
      encryptedContent: Buffer.from(
        createMessageDto.encryptedContent,
        'base64',
      ),
    });

    return this.messagesRepository.save(newMessage);
  }

  async getUnreadMessagesForUser(userId: string): Promise<Message[]> {
    return this.messagesRepository.find({
      where: { toUser: { id: userId }, read: false },
      order: { createdAt: 'ASC' },
    });
  }

  async findMessageById(messageId: string): Promise<Message | null> {
    return this.messagesRepository.findOneBy({ id: messageId });
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    await this.messagesRepository.update(messageId, { read: true });
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.messagesRepository.delete(messageId);
  }
}