// ==================== Alaa change for stock dashboard ====================
export class StockDashboardSummaryDto {
  total_products: number;
  total_services: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_categories: number;
  total_movements: number;
  total_stock_value: number;
}

export class LowStockProductDto {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  min_quantity: number;
  unit: string;
  category_name: string | null;
  stock_percentage: number;
}

export class RecentMovementDto {
  id: string;
  type: string;
  quantity: number;
  created_at: Date;
  product_name: string;
  product_sku: string;
  reference: string | null;
}

export class MovementsChartDto {
  date: string;
  entrees: number;
  sorties: number;
  ajustements: number;
}

export class StockForecastDto {
  id: string;
  name: string;
  sku: string;
  unit: string;
  current_quantity: number;
  avg_daily_consumption: number;
  days_remaining: number | null;
  risk_level: 'CRITICAL' | 'WARNING' | 'OK';
}

export class StockDashboardResponseDto {
  summary: StockDashboardSummaryDto;
  low_stock_products: LowStockProductDto[];
  recent_movements: RecentMovementDto[];
  movements_chart: MovementsChartDto[];
  stock_forecast: StockForecastDto[];
}
// ====================================================================
