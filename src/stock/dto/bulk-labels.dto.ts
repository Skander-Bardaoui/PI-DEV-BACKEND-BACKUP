import { IsArray, IsUUID, ArrayMaxSize } from 'class-validator';

export class BulkLabelsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  product_ids: string[];
}
