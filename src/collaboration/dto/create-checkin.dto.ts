import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCheckinDto {
  @IsUUID()
  businessId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  taskIds: string[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsBoolean()
  skipped: boolean;
}
