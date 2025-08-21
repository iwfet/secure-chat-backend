import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  @IsNotEmpty()
  toUserId: string;

  @IsString()
  @IsNotEmpty()
  encryptedContent: string; // Esperamos o conteúdo como uma string base64
}