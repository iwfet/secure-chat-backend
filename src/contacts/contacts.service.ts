import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact, ContactStatus } from './entities/contact.entity';
import { UsersService } from '../users/users.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactsRepository: Repository<Contact>,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async sendRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<Contact> {
    if (requesterId === addresseeId) {
      throw new ConflictException('Você não pode adicionar a si mesmo.');
    }

    const requester = await this.usersService.findOneById(requesterId);
    const addressee = await this.usersService.findOneById(addresseeId);

    if (!requester || !addressee) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const existingRequest = await this.contactsRepository.findOne({
      where: [
        { requester: { id: requesterId }, addressee: { id: addresseeId } },
        { requester: { id: addresseeId }, addressee: { id: requesterId } },
      ],
    });

    if (existingRequest) {
      throw new ConflictException('Já existe uma solicitação ou contato.');
    }

    const newRequest = this.contactsRepository.create({
      requester,
      addressee,
      status: ContactStatus.PENDING,
    });

    const savedRequest = await this.contactsRepository.save(newRequest);

    this.chatGateway.sendContactRequest(addresseeId, savedRequest);

    return savedRequest;
  }

  async getContacts(userId: string): Promise<Contact[]> {
    return this.contactsRepository.find({
      where: [
        { requester: { id: userId }, status: ContactStatus.ACCEPTED },
        { addressee: { id: userId }, status: ContactStatus.ACCEPTED },
      ],
      relations: ['requester', 'addressee'],
    });
  }

  async getPendingRequests(userId: string): Promise<Contact[]> {
    return this.contactsRepository.find({
      where: {
        addressee: { id: userId },
        status: ContactStatus.PENDING,
      },
      relations: ['requester', 'addressee'],
    });
  }

  async respondToRequest(
    userId: string,
    contactId: string,
    newStatus: ContactStatus.ACCEPTED | ContactStatus.REJECTED,
  ): Promise<Contact> {
    const request = await this.contactsRepository.findOne({
      where: { id: contactId },
      relations: ['requester', 'addressee'],
    });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    if (request.addressee.id !== userId) {
      throw new ForbiddenException('Você não pode responder a esta solicitação.');
    }

    if (request.status !== ContactStatus.PENDING) {
      throw new ConflictException('Esta solicitação já foi respondida.');
    }

    request.status = newStatus;
    const updatedContact = await this.contactsRepository.save(request);

    if (newStatus === ContactStatus.ACCEPTED) {
      this.chatGateway.notifyNewContact(updatedContact);
    }

    return updatedContact;
  }
}