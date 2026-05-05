// src/platform-admin/dto/create-ticket.dto.ts
import { IsString, IsEnum, IsNotEmpty, MinLength } from 'class-validator';
import { TicketPriority } from '../enums/ticket-priority.enum';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  body!: string;

  @IsEnum(TicketPriority)
  priority!: TicketPriority;
}
