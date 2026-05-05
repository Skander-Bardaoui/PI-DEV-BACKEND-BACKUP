import { IsArray, IsEnum, IsUUID, ArrayMinSize } from 'class-validator';

export class BulkUpdateRecurringInvoicesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];

  @IsEnum(['activate', 'pause', 'delete'])
  action: 'activate' | 'pause' | 'delete';
}
