import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    forwardRef(() => ContactsModule),
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}