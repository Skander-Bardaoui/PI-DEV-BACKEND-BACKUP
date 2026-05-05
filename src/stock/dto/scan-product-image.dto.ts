export class ScanProductImageResponseDto {
  name: string | null;
  description: string | null;
  barcode: string | null;
  unit: string | null;
  suggested_category_name: string | null;
  sale_price_ht: number | null;
  brand: string | null;
  confidence_note: string;
}
