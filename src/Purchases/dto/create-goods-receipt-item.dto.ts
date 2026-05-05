import { IsNotEmpty, IsNumber, IsPositive, IsUUID, Max } from "class-validator";

export class CreateGoodsReceiptItemDto {
  @IsUUID('4', { message: 'Ligne de BC invalide' })
  @IsNotEmpty({ message: 'La ligne de BC est obligatoire' })
  supplier_po_item_id: string;
 
  @IsNumber({}, { message: 'La quantité reçue doit être un nombre' })
  @IsPositive({ message: 'La quantité reçue doit être positive' })
  @Max(999999.999, { message: 'La quantité reçue ne peut pas dépasser 999999.999' })
  quantity_received: number;
}