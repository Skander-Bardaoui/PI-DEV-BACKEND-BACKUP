/**
 * Generate an internal barcode for a product
 * Format: {WAREHOUSECODE}-PRD-{first8charsOfProductId}
 * Example: WH01-PRD-A3F9B21C or GEN-PRD-A3F9B21C
 */
export function generateInternalBarcode(
  warehouseCode: string | null,
  productId: string,
): string {
  const prefix = warehouseCode ? warehouseCode.toUpperCase() : 'GEN';
  
  // Extract first 8 chars of product ID and remove any hyphens
  const productIdSlice = productId
    .substring(0, 8)
    .replace(/-/g, '')
    .toUpperCase();
  
  return `${prefix}-PRD-${productIdSlice}`;
}
