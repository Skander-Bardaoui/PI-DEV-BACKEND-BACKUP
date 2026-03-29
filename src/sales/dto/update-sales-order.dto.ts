import { PartialType } from '@nestjs/mapped-types';
import { CreateSalesOrderDto } from './create-sales-order.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { SalesOrderStatus } from '../entities/sales-order.entity';

export class UpdateSalesOrderDto extends PartialType(CreateSalesOrderDto) {
  @IsOptional()
  @IsEnum(SalesOrderStatus, { message: 'Statut invalide' })
  status?: SalesOrderStatus;
}
