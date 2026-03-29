import { PartialType } from '@nestjs/mapped-types';
import { CreateDeliveryNoteDto } from './create-delivery-note.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateDeliveryNoteDto extends PartialType(CreateDeliveryNoteDto) {
  @IsOptional()
  @IsString()
  status?: string;
}
