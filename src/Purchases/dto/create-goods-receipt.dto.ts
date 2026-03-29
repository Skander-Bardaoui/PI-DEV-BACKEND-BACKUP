import { Type } from "class-transformer";
import { CreateGoodsReceiptItemDto } from "./create-goods-receipt-item.dto";
import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export class CreateGoodsReceiptDto {
  @IsOptional()
  @IsString()
  receipt_date?: string;
 
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
 
  @IsArray({ message: 'Les lignes doivent être un tableau' })
  @ArrayMinSize(1, { message: 'Le bon de réception doit contenir au moins une ligne' })
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  items: CreateGoodsReceiptItemDto[];
}