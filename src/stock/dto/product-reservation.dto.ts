// ==================== Alaa change for product reservations ====================
import { IsString, IsNumber, Min, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty()
  product_id: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsString()
  @IsOptional()
  supplier_id?: string;
}

export class ReservationResponseDto {
  id: string;
  name: string;
  sku: string;
  reserved_quantity: number;
  current_quantity: number;
  min_quantity: number;
  unit: string;
  cost: number | null;
  price: number;
  default_supplier_id: string | null;
  supplier_name?: string | null;
  reserved_supplier_id?: string | null;
  reserved_supplier_name?: string | null;
}
// ====================================================================
