/**
 * Service de prédiction ML - Communication avec le service Python
 */
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';

import {
  PredictionRequestDto,
  BatchPredictionRequestDto,
  PredictionResponse,
  BatchPredictionResponse,
  RecommendationsResponse,
  PurchaseHistoryItemDto,
} from '../dto/ml-prediction.dto';
import { SupplierPO } from '../entities/supplier-po.entity';
import { SupplierPOItem } from '../entities/supplier-po-item.entity';
import { Product } from '../../stock/entities/product.entity';
import { MLRecommendationAction, MLRecommendationActionType } from '../entities/ml-recommendation-action.entity';

@Injectable()
export class MlPredictionService {
  private readonly logger = new Logger(MlPredictionService.name);
  private readonly mlServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(SupplierPO)
    private readonly supplierPORepository: Repository<SupplierPO>,
    @InjectRepository(SupplierPOItem)
    private readonly supplierPOItemRepository: Repository<SupplierPOItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(MLRecommendationAction)
    private readonly mlActionRepository: Repository<MLRecommendationAction>,
  ) {
    this.mlServiceUrl = this.configService.get<string>(
      'ML_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  /**
   * Vérifier la santé du service ML
   */
  async checkHealth(): Promise<{ status: string; model_loaded: boolean; version: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.mlServiceUrl}/api/v1/health`),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Erreur health check ML: ${error.message}`);
      throw new HttpException(
        'Service ML indisponible',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Prédire la demande pour un produit
   */
  async predictDemand(
    request: PredictionRequestDto,
  ): Promise<PredictionResponse> {
    try {
      this.logger.log(`Prédiction demandée pour produit ${request.product_id}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.mlServiceUrl}/api/v1/predict/demand`,
          request,
        ),
      );

      this.logger.log(`Prédiction réussie: ${response.data.predicted_quantity} unités`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Erreur prédiction ML: ${error.message}`);
      
      if (error.response?.status === 400) {
        throw new HttpException(
          error.response.data.detail || 'Données insuffisantes pour la prédiction',
          HttpStatus.BAD_REQUEST,
        );
      }
      
      throw new HttpException(
        'Erreur lors de la prédiction ML',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Prédictions en batch pour plusieurs produits
   */
  async predictBatch(
    request: BatchPredictionRequestDto,
  ): Promise<BatchPredictionResponse> {
    try {
      this.logger.log(`Prédiction batch pour ${request.products.length} produits`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.mlServiceUrl}/api/v1/predict/batch`,
          request,
        ),
      );

      this.logger.log(
        `Batch terminé: ${response.data.successful} succès, ${response.data.failed} erreurs`,
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Erreur prédiction batch: ${error.message}`);
      throw new HttpException(
        'Erreur lors de la prédiction batch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtenir les recommandations d'achat
   */
  async getRecommendations(
    request: BatchPredictionRequestDto,
  ): Promise<RecommendationsResponse> {
    try {
      this.logger.log('Génération des recommandations d\'achat');

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.mlServiceUrl}/api/v1/recommendations`,
          request,
        ),
      );

      this.logger.log(
        `${response.data.total_recommendations} recommandations générées (${response.data.urgent_count} urgentes)`,
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Erreur recommandations: ${error.message}`);
      throw new HttpException(
        'Erreur lors de la génération des recommandations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Construire l'historique d'achat pour un produit depuis la base de données
   */
  async buildProductHistory(
    productId: string,
    businessId: string,
  ): Promise<PurchaseHistoryItemDto[]> {
    try {
      // Récupérer le produit
      const product = await this.productRepository.findOne({
        where: { id: productId },
      });

      if (!product) {
        throw new HttpException('Produit non trouvé', HttpStatus.NOT_FOUND);
      }

      // Récupérer tous les items de BC pour ce produit
      const poItems = await this.supplierPOItemRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.supplier_po', 'po')
        .leftJoinAndSelect('po.supplier', 'supplier')
        .where('item.product_id = :productId', { productId })
        .andWhere('po.business_id = :businessId', { businessId })
        .andWhere('po.status IN (:...statuses)', {
          statuses: ['CONFIRMED', 'FULLY_RECEIVED', 'PARTIALLY_RECEIVED'],
        })
        .orderBy('po.created_at', 'ASC')
        .getMany();

      if (poItems.length === 0) {
        throw new HttpException(
          'Aucun historique d\'achat trouvé pour ce produit',
          HttpStatus.NOT_FOUND,
        );
      }

      // Transformer en format ML
      const history: PurchaseHistoryItemDto[] = poItems.map((item) => ({
        date: item.supplier_po.created_at.toISOString().split('T')[0],
        product_id: productId,
        product_name: product.name,
        quantity: item.quantity_ordered,
        price: item.unit_price_ht,
        supplier: item.supplier_po.supplier?.name || 'Inconnu',
        category: (product.category as unknown as string) || undefined,
      }));

      this.logger.log(
        `Historique construit: ${history.length} points de données pour ${product.name}`,
      );

      return history;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Erreur construction historique: ${error.message}`);
      throw new HttpException(
        'Erreur lors de la construction de l\'historique',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Prédire pour un produit en utilisant l'historique de la base de données
   */
  async predictForProduct(
    productId: string,
    businessId: string,
    predictionDays: number = 30,
  ): Promise<PredictionResponse> {
    const history = await this.buildProductHistory(productId, businessId);

    return this.predictDemand({
      product_id: productId,
      history,
      prediction_days: predictionDays,
    });
  }

  /**
   * Obtenir les recommandations pour tous les produits d'un business
   */
  async getBusinessRecommendations(
    businessId: string,
    predictionDays: number = 30,
  ): Promise<RecommendationsResponse> {
    try {
      // Récupérer tous les produits avec historique d'achat
      const products = await this.productRepository
        .createQueryBuilder('product')
        .leftJoin('product.supplierPOItems', 'poItem')
        .leftJoin('poItem.supplier_po', 'po')
        .where('po.business_id = :businessId', { businessId })
        .andWhere('po.status IN (:...statuses)', {
          statuses: ['CONFIRMED', 'FULLY_RECEIVED', 'PARTIALLY_RECEIVED'],
        })
        .groupBy('product.id')
        .having('COUNT(poItem.id) >= 3') // Au moins 3 achats
        .getMany();

      if (products.length === 0) {
        return {
          recommendations: [],
          total_recommendations: 0,
          urgent_count: 0,
          total_estimated_value: 0,
          generated_at: new Date().toISOString(),
        };
      }

      this.logger.log(
        `Génération des recommandations pour ${products.length} produits`,
      );

      // Construire les requêtes pour chaque produit
      const productRequests = await Promise.all(
        products.map(async (product) => {
          try {
            const history = await this.buildProductHistory(
              product.id,
              businessId,
            );
            return {
              product_id: product.id,
              history,
            };
          } catch (error: any) {
            this.logger.warn(
              `Impossible de construire l'historique pour ${product.name}: ${error.message}`,
            );
            return null;
          }
        }),
      );

      // Filtrer les produits avec historique valide
      const validRequests = productRequests.filter((req) => req !== null);

      if (validRequests.length === 0) {
        return {
          recommendations: [],
          total_recommendations: 0,
          urgent_count: 0,
          total_estimated_value: 0,
          generated_at: new Date().toISOString(),
        };
      }

      // Appeler le service ML
      const mlRecommendations = await this.getRecommendations({
        products: validRequests,
        prediction_days: predictionDays,
      });

      // Enrichir avec le statut de traitement
      const enrichedRecommendations = await this.enrichWithProcessingStatus(
        mlRecommendations.recommendations,
        businessId,
      );

      return {
        ...mlRecommendations,
        recommendations: enrichedRecommendations,
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur recommandations business: ${error.message}`,
      );
      throw new HttpException(
        'Erreur lors de la génération des recommandations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Enrichir les recommandations avec le statut de traitement
   */
  private async enrichWithProcessingStatus(
    recommendations: PredictionResponse[],
    businessId: string,
  ): Promise<PredictionResponse[]> {
    const today = new Date().toISOString().split('T')[0];

    return Promise.all(
      recommendations.map(async (rec) => {
        // Chercher si une action a été prise pour ce produit aujourd'hui
        const action = await this.mlActionRepository.findOne({
          where: {
            business_id: businessId,
            product_id: rec.product_id,
            recommendation_date: today,
            action_type: MLRecommendationActionType.BC_CREATED,
          },
          relations: ['supplier_po'],
          order: { created_at: 'DESC' },
        });

        if (action) {
          return {
            ...rec,
            is_processed: true,
            processed_at: action.created_at.toISOString(),
            supplier_po_id: action.supplier_po_id,
            supplier_po_number: action.supplier_po?.po_number,
          };
        }

        return {
          ...rec,
          is_processed: false,
        };
      }),
    );
  }

  /**
   * Marquer une recommandation comme traitée (BC créé)
   */
  async markAsProcessed(
    businessId: string,
    productId: string,
    supplierPOId: string,
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const action = this.mlActionRepository.create({
      business_id: businessId,
      product_id: productId,
      recommendation_date: today,
      action_type: MLRecommendationActionType.BC_CREATED,
      supplier_po_id: supplierPOId,
      notes: 'BC créé automatiquement depuis une recommandation ML',
    });

    await this.mlActionRepository.save(action);
    this.logger.log(
      `Recommandation marquée comme traitée: produit ${productId}, BC ${supplierPOId}`,
    );
  }
}