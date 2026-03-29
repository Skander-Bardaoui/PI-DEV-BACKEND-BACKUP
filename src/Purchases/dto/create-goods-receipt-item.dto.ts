import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from "class-validator";

export class CreateGoodsReceiptItemDto {
  @IsUUID('4', { message: 'Ligne de BC invalide' })
  @IsNotEmpty()
  supplier_po_item_id: string;
 
  @IsNumber()
  @IsPositive({ message: 'La quantité reçue doit être positive' })
  quantity_received: number;
}