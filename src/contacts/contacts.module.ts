import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './entities/contact.entity';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { UsersModule } from '../users/users.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact]),
    UsersModule,
    forwardRef(() => ChatModule),
  ],
  providers: [ContactsService],
  controllers: [ContactsController],
  exports: [ContactsService],
})
export class ContactsModule {}