// src/Purchases/controllers/supplier-scoring.controller.ts
import {
  Controller, Get, Param, ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { AuthGuard }             from '@nestjs/passport';
import { SupplierScoringService } from '../services/supplier-scoring.service';
import { SupplierAiInsightsService } from '../services/supplier-ai-insights.service';

@UseGuards(AuthGuard('jwt'))
@Controller('businesses/:businessId/supplier-scoring')
export class SupplierScoringController {

  constructor(
    private readonly svc: SupplierScoringService,
    private readonly aiInsights: SupplierAiInsightsService,
  ) {}

  // GET /businesses/:bId/supplier-scoring/ranking
  // Classement de tous les fournisseurs
  @Get('ranking')
  ranking(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.svc.rankSuppliers(businessId);
  }

  // GET /businesses/:bId/supplier-scoring/:supplierId
  // Score détaillé d'un fournisseur
  @Get(':supplierId')
  score(
    @Param('businessId',  ParseUUIDPipe) businessId:  string,
    @Param('supplierId',  ParseUUIDPipe) supplierId:  string,
  ) {
    return this.svc.scoreSupplier(businessId, supplierId);
  }

  // GET /businesses/:bId/supplier-scoring/:supplierId/ai-insights
  // Analyse IA avancée avec prédictions et recommandations
  @Get(':supplierId/ai-insights')
  async aiInsightsAnalysis(
    @Param('businessId',  ParseUUIDPipe) businessId:  string,
    @Param('supplierId',  ParseUUIDPipe) supplierId:  string,
  ): Promise<any> {
    const score = await this.svc.scoreSupplier(businessId, supplierId);
    return this.aiInsights.generateInsights(score);
  }
}