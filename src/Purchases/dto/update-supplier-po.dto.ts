import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { CreateSupplierPOItemDto } from "./create-supplier-po-item.dto";
import { Transform, Type } from "class-transformer";

export class UpdateSupplierPODto {
  @IsOptional() @IsString() expected_delivery?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
 
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierPOItemDto)
  items?: CreateSupplierPOItemDto[];
}
 
export class QuerySupplierPOsDto {
  @IsOptional() @IsUUID() supplier_id?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() date_from?: string;
  @IsOptional() @IsString() date_to?: string;
 
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 1)
  @IsNumber() @Min(1)
  page?: number = 1;
 
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 20)
  @IsNumber() @Min(1) @Max(100)
  limit?: number = 20;
}