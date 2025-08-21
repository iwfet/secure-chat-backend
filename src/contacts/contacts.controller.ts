import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactStatus } from './entities/contact.entity';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post('requests')
  sendRequest(@Request() req, @Body('addresseeId') addresseeId: string) {
    const requesterId = req.user.userId;
    return this.contactsService.sendRequest(requesterId, addresseeId);
  }

  @Get()
  getMyContacts(@Request() req) {
    const userId = req.user.userId;
    return this.contactsService.getContacts(userId);
  }

  @Get('requests/pending')
  getPendingRequests(@Request() req) {
    const userId = req.user.userId;
    return this.contactsService.getPendingRequests(userId);
  }

  @Put('requests/:contactId/accept')
  @HttpCode(200)
  acceptRequest(@Request() req, @Param('contactId') contactId: string) {
    const userId = req.user.userId;
    return this.contactsService.respondToRequest(
      userId,
      contactId,
      ContactStatus.ACCEPTED,
    );
  }

  @Put('requests/:contactId/reject')
  @HttpCode(200)
  rejectRequest(@Request() req, @Param('contactId') contactId: string) {
    const userId = req.user.userId;
    return this.contactsService.respondToRequest(
      userId,
      contactId,
      ContactStatus.REJECTED,
    );
  }
}