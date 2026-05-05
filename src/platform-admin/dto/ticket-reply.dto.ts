// src/platform-admin/dto/ticket-reply.dto.ts
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class TicketReplyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  message!: string;
}
