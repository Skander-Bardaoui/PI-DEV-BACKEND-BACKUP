/**
 * DTOs pour les prédictions ML
 */
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// ═══════════════════════════════════════════════════════════════════════════
// SCHÉMAS ZOD
// ═══════════════════════════════════════════════════════════════════════════

export const purchaseHistoryItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  product_id: z.string().min(1),
  product_name: z.string().min(1),
  quantity: z.number().positive(),
  price: z.number().min(0),
  supplier: z.string().optional(),
  category: z.string().optional(),
});

export const predictionRequestSchema = z.object({
  product_id: z.string().min(1),
  history: z.array(purchaseHistoryItemSchema).min(1),
  prediction_days: z.number().int().min(1).max(365).default(30),
});

export const batchPredictionRequestSchema = z.object({
  products: z.array(z.object({
    product_id: z.string().min(1),
    history: z.array(purchaseHistoryItemSchema).min(1),
  })).min(1),
  prediction_days: z.number().int().min(1).max(365).default(30),
});

// ═══════════════════════════════════════════════════════════════════════════
// DTOs NESTJS
// ═══════════════════════════════════════════════════════════════════════════

export class PurchaseHistoryItemDto extends createZodDto(purchaseHistoryItemSchema) {}
export class PredictionRequestDto extends createZodDto(predictionRequestSchema) {}
export class BatchPredictionRequestDto extends createZodDto(batchPredictionRequestSchema) {}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES DE RÉPONSE
// ═══════════════════════════════════════════════════════════════════════════

export interface PredictionResponse {
  product_id: string;
  product_name: string;
  predicted_quantity: number;
  predicted_date: string;
  confidence: number;
  recommendation: string;
  historical_avg: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  days_until_order: number;
  estimated_value?: number;
  urgency_level: 'urgent' | 'soon' | 'planned';
  data_quality: Record<string, any>;
  seasonality_detected: boolean;
}

export interface BatchPredictionResponse {
  predictions: PredictionResponse[];
  errors: Array<{ product_id: string; error: string }>;
  total_processed: number;
  successful: number;
  failed: number;
}

export interface RecommendationsResponse {
  recommendations: PredictionResponse[];
  total_recommendations: number;
  urgent_count: number;
  total_estimated_value: number;
  generated_at: string;
}