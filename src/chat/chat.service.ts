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
    const toUser = await this.usersService.findOneById(createMessageDto.toUserId);

    if (!fromUser || !toUser) {
      throw new NotFoundException('Usuário remetente ou destinatário não encontrado.');
    }

    const newMessage = this.messagesRepository.create({
      fromUser,
      toUser,
      // O conteúdo criptografado vem como base64 do cliente e é salvo como bytes no banco
      encryptedContent: Buffer.from(createMessageDto.encryptedContent, 'base64'),
    });

    return this.messagesRepository.save(newMessage);
  }

  async getAndClearMessagesForUser(userId: string): Promise<Message[]> {
    // Busca no banco todas as mensagens onde o destinatário é o usuário logado
    const messages = await this.messagesRepository.find({
      where: { toUser: { id: userId } },
      order: { id: 'ASC' }, // Garante que as mensagens sejam processadas em ordem
      relations: ['fromUser', 'toUser'], // Carrega os objetos de usuário completos
    });

    // Uma vez que as mensagens foram entregues ao cliente, nós as removemos do banco de dados.
    // Isso garante que o servidor não mantenha um histórico de conversas.
    if (messages.length > 0) {
      await this.messagesRepository.remove(messages);
    }

    return messages;
  }
}