import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ImproveDescriptionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}
