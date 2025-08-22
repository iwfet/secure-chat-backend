import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  toSocketId: string;

  @IsString()
  @IsNotEmpty()
  encryptedContent: string;
}