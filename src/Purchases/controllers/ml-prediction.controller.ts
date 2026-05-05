/**
 * Contrôleur ML - Prédictions des besoins d'achat
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import { MlPredictionService } from '../services/ml-prediction.service';
import {
  PredictionRequestDto,
  BatchPredictionRequestDto,
  PredictionResponse,
  BatchPredictionResponse,
  RecommendationsResponse,
} from '../dto/ml-prediction.dto';

@Controller('purchases/ml')
@UseGuards(JwtAuthGuard)
export class MlPredictionController {
  constructor(private readonly mlPredictionService: MlPredictionService) {}

  /**
   * Health check du service ML
   * GET /purchases/ml/health
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async checkHealth() {
    return this.mlPredictionService.checkHealth();
  }

  /**
   * Prédire la demande pour un produit (avec données personnalisées)
   * POST /purchases/ml/predict
   */
  @Post('predict')
  @HttpCode(HttpStatus.OK)
  async predictDemand(
    @Body() request: PredictionRequestDto,
  ): Promise<PredictionResponse> {
    return this.mlPredictionService.predictDemand(request);
  }

  /**
   * Prédictions en batch (avec données personnalisées)
   * POST /purchases/ml/predict/batch
   */
  @Post('predict/batch')
  @HttpCode(HttpStatus.OK)
  async predictBatch(
    @Body() request: BatchPredictionRequestDto,
  ): Promise<BatchPredictionResponse> {
    return this.mlPredictionService.predictBatch(request);
  }

  /**
   * Prédire pour un produit spécifique (utilise l'historique de la BDD)
   * GET /purchases/ml/predict/product/:productId
   */
  @Get('predict/product/:productId')
  @HttpCode(HttpStatus.OK)
  async predictForProduct(
    @Param('productId') productId: string,
    @Request() req,
    @Query('prediction_days') predictionDays?: number,
    @Query('business_id') businessId?: string,
  ): Promise<PredictionResponse> {
    const targetBusinessId = businessId || req.user?.currentBusinessId || req.user?.business_id;
    
    if (!targetBusinessId) {
      throw new HttpException(
        'Business ID requis',
        HttpStatus.BAD_REQUEST,
      );
    }
    
    return this.mlPredictionService.predictForProduct(
      productId,
      targetBusinessId,
      predictionDays || 30,
    );
  }

  /**
   * Obtenir les recommandations d'achat pour le business
   * GET /purchases/ml/recommendations
   */
  @Get('recommendations')
  @HttpCode(HttpStatus.OK)
  async getRecommendations(
    @Request() req,
    @Query('prediction_days') predictionDays?: number,
    @Query('business_id') businessId?: string,
  ): Promise<RecommendationsResponse> {
    // Utiliser le businessId du query, currentBusinessId ou business_id du user
    const targetBusinessId = businessId || req.user?.currentBusinessId || req.user?.business_id;
    
    // Log pour déboguer
    console.log('ML Recommendations - User:', req.user);
    console.log('ML Recommendations - Business ID:', targetBusinessId);
    
    if (!targetBusinessId) {
      console.log('ML Recommendations - Aucun business ID trouvé, retour vide');
      return {
        recommendations: [],
        total_recommendations: 0,
        urgent_count: 0,
        total_estimated_value: 0,
        generated_at: new Date().toISOString(),
      };
    }
    
    console.log('ML Recommendations - Appel du service avec business:', targetBusinessId);
    return this.mlPredictionService.getBusinessRecommendations(
      targetBusinessId,
      predictionDays || 30,
    );
  }

  /**
   * Construire l'historique d'achat pour un produit
   * GET /purchases/ml/history/:productId
   */
  @Get('history/:productId')
  @HttpCode(HttpStatus.OK)
  async getProductHistory(
    @Param('productId') productId: string,
    @Request() req,
    @Query('business_id') businessId?: string,
  ) {
    const targetBusinessId = businessId || req.user?.currentBusinessId || req.user?.business_id;
    
    if (!targetBusinessId) {
      throw new HttpException(
        'Business ID requis',
        HttpStatus.BAD_REQUEST,
      );
    }
    
    const history = await this.mlPredictionService.buildProductHistory(
      productId,
      targetBusinessId,
    );
    return {
      product_id: productId,
      data_points: history.length,
      history,
    };
  }
}