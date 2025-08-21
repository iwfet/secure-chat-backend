import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact, ContactStatus } from './entities/contact.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactsRepository: Repository<Contact>,
    private readonly usersService: UsersService,
  ) {
  }

  async sendRequest(requesterId: string, addresseeId: string): Promise<Contact> {
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

    return this.contactsRepository.save(newRequest);
  }

  async getContacts(userId: string): Promise<Contact[]> {
    return this.contactsRepository.find({
      where: [
        { requester: { id: userId }, status: ContactStatus.ACCEPTED },
        { addressee: { id: userId }, status: ContactStatus.ACCEPTED },
      ],
    });
  }

  async getPendingRequests(userId: string): Promise<Contact[]> {
    return this.contactsRepository.find({
      where: {
        addressee: { id: userId },
        status: ContactStatus.PENDING,
      },
    });
  }

  async respondToRequest(
    userId: string,
    contactId: string,
    newStatus: ContactStatus.ACCEPTED | ContactStatus.REJECTED,
  ): Promise<Contact> {
    const request = await this.contactsRepository.findOneBy({ id: contactId });

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
    return this.contactsRepository.save(request);
  }

  async areUsersContacts(userId1: string, userId2: string): Promise<boolean> {
    const contact = await this.contactsRepository.findOne({
      where: [
        {
          requester: { id: userId1 },
          addressee: { id: userId2 },
          status: ContactStatus.ACCEPTED,
        },
        {
          requester: { id: userId2 },
          addressee: { id: userId1 },
          status: ContactStatus.ACCEPTED,
        },
      ],
    });
    return !!contact;
  }
}