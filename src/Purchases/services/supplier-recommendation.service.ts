// src/Purchases/services/supplier-recommendation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { SupplierPO } from '../entities/supplier-po.entity';
import { PurchaseInvoice } from '../entities/purchase-invoice.entity';
import { InvoiceStatus } from '../enum/invoice-status.enum';
import { SupplierScoringService, SupplierScore } from './supplier-scoring.service';

export interface SupplierRecommendation {
  supplier_id: string;
  supplier_name: string;
  score: number;
  rank: number;
  
  // Métriques
  avg_price: number;
  price_competitiveness: number; // -100 à +100 (négatif = moins cher)
  delivery_reliability: number; // 0-100
  quality_score: number; // 0-100
  dispute_rate: number; // 0-100
  
  // Statistiques
  total_orders: number;
  total_disputes: number;
  avg_delivery_days: number;
  last_order_date: Date | null;
  
  // Recommandation IA
  recommendation_strength: 'HIGHLY_RECOMMENDED' | 'RECOMMENDED' | 'ACCEPTABLE' | 'NOT_RECOMMENDED';
  explanation: string;
  pros: string[];
  cons: string[];
}

@Injectable()
export class SupplierRecommendationService {
  private readonly logger = new Logger(SupplierRecommendationService.name);

  constructor(
    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,
    @InjectRepository(SupplierPO)
    private poRepo: Repository<SupplierPO>,
    @InjectRepository(PurchaseInvoice)
    private invoiceRepo: Repository<PurchaseInvoice>,
    private scoringService: SupplierScoringService,
  ) {}

  /**
   * Recommande les meilleurs fournisseurs pour un produit/catégorie
   */
  async recommendSuppliers(
    businessId: string,
    productName?: string,
    category?: string,
  ): Promise<SupplierRecommendation[]> {
    this.logger.log(`Recommandation fournisseurs pour business ${businessId}, produit: ${productName}, catégorie: ${category}`);

    // 1. Récupérer tous les fournisseurs actifs
    const suppliers = await this.supplierRepo.find({
      where: { business_id: businessId, is_active: true },
    });

    if (suppliers.length === 0) {
      return [];
    }

    // 2. Analyser chaque fournisseur
    const recommendations: SupplierRecommendation[] = [];

    for (const supplier of suppliers) {
      const analysis = await this.analyzeSupplier(businessId, supplier, productName, category);
      if (analysis) {
        recommendations.push(analysis);
      }
    }

    // 3. Trier par score décroissant
    recommendations.sort((a, b) => b.score - a.score);

    // 4. Assigner les rangs
    recommendations.forEach((rec, index) => {
      rec.rank = index + 1;
    });

    return recommendations;
  }

  /**
   * Analyse un fournisseur spécifique
   */
  private async analyzeSupplier(
    businessId: string,
    supplier: Supplier,
    productName?: string,
    category?: string,
  ): Promise<SupplierRecommendation | null> {
    try {
      // Récupérer les BCs du fournisseur
      const pos = await this.poRepo.find({
        where: { business_id: businessId, supplier_id: supplier.id },
        relations: ['items'],
        order: { created_at: 'DESC' },
      });

      // Récupérer les factures du fournisseur
      const invoices = await this.invoiceRepo.find({
        where: { business_id: businessId, supplier_id: supplier.id },
        order: { created_at: 'DESC' },
      });

      // Récupérer le score du fournisseur via le service de scoring
      let scoreRecord: SupplierScore | null = null;
      try {
        scoreRecord = await this.scoringService.scoreSupplier(businessId, supplier.id);
      } catch (error) {
        this.logger.warn(`Impossible de calculer le score pour ${supplier.id}:`, error);
      }

      // Calculer les métriques
      const metrics = this.calculateMetrics(pos, invoices, scoreRecord, productName);

      // Si des produits sont spécifiés et qu'aucun item ne correspond, ignorer ce fournisseur
      if (productName && metrics.totalItems === 0) {
        this.logger.debug(`Fournisseur ${supplier.name} ignoré : aucun historique pour les produits "${productName}"`);
        return null;
      }

      // Générer la recommandation IA
      const aiRecommendation = this.generateAIRecommendation(supplier, metrics, scoreRecord, productName);

      return {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        score: metrics.overallScore,
        rank: 0, // Sera assigné plus tard
        
        avg_price: metrics.avgPrice,
        price_competitiveness: 0, // Sera calculé après comparaison
        delivery_reliability: metrics.deliveryReliability,
        quality_score: metrics.qualityScore,
        dispute_rate: metrics.disputeRate,
        
        total_orders: pos.length,
        total_disputes: metrics.totalDisputes,
        avg_delivery_days: metrics.avgDeliveryDays,
        last_order_date: pos.length > 0 ? pos[0].created_at : null,
        
        ...aiRecommendation,
      };
    } catch (error) {
      this.logger.error(`Erreur analyse fournisseur ${supplier.id}:`, error);
      return null;
    }
  }

  /**
   * Calcule les métriques d'un fournisseur
   */
  private calculateMetrics(
    pos: SupplierPO[],
    invoices: PurchaseInvoice[],
    scoreRecord: SupplierScore | null,
    productName?: string,
  ) {
    // Prix moyen
    let totalAmount = 0;
    let totalItems = 0;

    // Si plusieurs produits sont fournis (séparés par virgule), on les analyse tous
    const productFilters = productName 
      ? productName.split(',').map(p => p.trim().toLowerCase()).filter(p => p.length > 0)
      : [];

    for (const po of pos) {
      if (po.items && po.items.length > 0) {
        for (const item of po.items) {
          // Filtrer par produit si spécifié
          if (productFilters.length > 0) {
            const itemDesc = item.description.toLowerCase();
            const matchesAnyProduct = productFilters.some(filter => itemDesc.includes(filter));
            if (!matchesAnyProduct) {
              continue; // Ignore les produits qui ne correspondent pas
            }
          }
          
          totalAmount += item.quantity_ordered * item.unit_price_ht;
          totalItems++;
        }
      }
    }

    const avgPrice = totalItems > 0 ? totalAmount / totalItems : 0;

    // Extraire les scores depuis les critères
    let deliveryReliability = 70;
    let qualityScore = 70;

    if (scoreRecord) {
      // Critère "Respect des délais" pour la fiabilité de livraison
      const deliveryCriteria = scoreRecord.criteria.find(c => c.name === 'Respect des délais');
      if (deliveryCriteria) {
        deliveryReliability = deliveryCriteria.score;
      }
      
      // Score global pour la qualité
      qualityScore = scoreRecord.total_score;
    }

    // Taux de litiges (factures avec status DISPUTED)
    const totalDisputes = invoices.filter(inv => inv.status === InvoiceStatus.DISPUTED).length;
    const disputeRate = invoices.length > 0 ? (totalDisputes / invoices.length) * 100 : 0;

    // Délai moyen de livraison (estimation basée sur les BCs)
    const avgDeliveryDays = this.estimateAvgDeliveryDays(pos);

    // Score global (0-100)
    const overallScore = this.calculateOverallScore({
      deliveryReliability,
      qualityScore,
      disputeRate,
      totalOrders: pos.length,
    });

    return {
      avgPrice,
      deliveryReliability,
      qualityScore,
      disputeRate,
      totalDisputes,
      avgDeliveryDays,
      overallScore,
      totalItems, // Nombre d'items correspondant aux produits recherchés
    };
  }

  /**
   * Estime le délai moyen de livraison
   */
  private estimateAvgDeliveryDays(pos: SupplierPO[]): number {
    if (pos.length === 0) return 7; // Valeur par défaut

    let totalDays = 0;
    let count = 0;

    for (const po of pos) {
      if (po.expected_delivery && po.created_at) {
        const expectedDate = new Date(po.expected_delivery);
        const createdDate = new Date(po.created_at);
        const days = Math.ceil((expectedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0 && days < 365) { // Filtrer les valeurs aberrantes
          totalDays += days;
          count++;
        }
      }
    }

    return count > 0 ? Math.round(totalDays / count) : 7;
  }

  /**
   * Calcule le score global
   */
  private calculateOverallScore(metrics: {
    deliveryReliability: number;
    qualityScore: number;
    disputeRate: number;
    totalOrders: number;
  }): number {
    const { deliveryReliability, qualityScore, disputeRate, totalOrders } = metrics;

    // Pondération
    const deliveryWeight = 0.3;
    const qualityWeight = 0.3;
    const disputeWeight = 0.3;
    const experienceWeight = 0.1;

    // Score de dispute (inversé : moins de litiges = meilleur score)
    const disputeScore = Math.max(0, 100 - disputeRate);

    // Score d'expérience (plus de commandes = meilleur score, plafonné à 100)
    const experienceScore = Math.min(100, totalOrders * 5);

    // Score global
    const score = 
      deliveryReliability * deliveryWeight +
      qualityScore * qualityWeight +
      disputeScore * disputeWeight +
      experienceScore * experienceWeight;

    return Math.round(score);
  }

  /**
   * Génère la recommandation IA avec explication
   */
  private generateAIRecommendation(
    supplier: Supplier,
    metrics: any,
    scoreRecord: SupplierScore | null,
    productName?: string,
  ): {
    recommendation_strength: SupplierRecommendation['recommendation_strength'];
    explanation: string;
    pros: string[];
    cons: string[];
  } {
    const pros: string[] = [];
    const cons: string[] = [];
    let strength: SupplierRecommendation['recommendation_strength'] = 'ACCEPTABLE';

    // Mention spéciale si analyse basée sur des produits spécifiques
    const productContext = productName ? ` pour ces produits` : '';

    // Analyser les points forts
    if (metrics.deliveryReliability >= 90) {
      pros.push(`Livraison très fiable${productContext} (${metrics.deliveryReliability}%)`);
    } else if (metrics.deliveryReliability >= 75) {
      pros.push(`Livraison fiable${productContext} (${metrics.deliveryReliability}%)`);
    }

    if (metrics.disputeRate <= 5) {
      pros.push(`Très peu de litiges${productContext} (${metrics.disputeRate.toFixed(1)}%)`);
    } else if (metrics.disputeRate <= 15) {
      pros.push(`Taux de litiges acceptable${productContext} (${metrics.disputeRate.toFixed(1)}%)`);
    }

    if (metrics.qualityScore >= 85) {
      pros.push(`Excellente qualité (score ${metrics.qualityScore})`);
    } else if (metrics.qualityScore >= 70) {
      pros.push(`Bonne qualité (score ${metrics.qualityScore})`);
    }

    if (metrics.avgDeliveryDays <= 3) {
      pros.push(`Livraison rapide (${metrics.avgDeliveryDays} jours)`);
    } else if (metrics.avgDeliveryDays <= 7) {
      pros.push(`Délai de livraison standard (${metrics.avgDeliveryDays} jours)`);
    }

    if (productName && metrics.totalItems > 0) {
      pros.push(`${metrics.totalItems} commande(s) de ces produits dans l'historique`);
    }

    // Analyser les points faibles
    if (metrics.deliveryReliability < 60) {
      cons.push(`Livraison peu fiable${productContext} (${metrics.deliveryReliability}%)`);
    }

    if (metrics.disputeRate > 20) {
      cons.push(`Taux de litiges élevé${productContext} (${metrics.disputeRate.toFixed(1)}%)`);
    }

    if (metrics.qualityScore < 60) {
      cons.push(`Qualité insuffisante (score ${metrics.qualityScore})`);
    }

    if (metrics.avgDeliveryDays > 14) {
      cons.push(`Délai de livraison long (${metrics.avgDeliveryDays} jours)`);
    }

    if (productName && metrics.totalItems === 0) {
      cons.push(`Aucun historique pour ces produits spécifiques`);
    }

    // Déterminer la force de la recommandation
    if (metrics.overallScore >= 85 && cons.length === 0) {
      strength = 'HIGHLY_RECOMMENDED';
    } else if (metrics.overallScore >= 70 && cons.length <= 1) {
      strength = 'RECOMMENDED';
    } else if (metrics.overallScore < 50 || cons.length >= 3) {
      strength = 'NOT_RECOMMENDED';
    }

    // Générer l'explication
    let explanation = '';
    const productSuffix = productName ? ` pour ces produits` : '';
    
    if (strength === 'HIGHLY_RECOMMENDED') {
      explanation = `${supplier.name} est fortement recommandé${productSuffix} : excellent historique avec ${pros.length} points forts identifiés.`;
    } else if (strength === 'RECOMMENDED') {
      explanation = `${supplier.name} est recommandé${productSuffix} : bon historique avec un score global de ${metrics.overallScore}/100.`;
    } else if (strength === 'NOT_RECOMMENDED') {
      explanation = `${supplier.name} n'est pas recommandé${productSuffix} : ${cons.length} problèmes identifiés nécessitant attention.`;
    } else {
      explanation = `${supplier.name} est acceptable${productSuffix} : performance moyenne avec un score de ${metrics.overallScore}/100.`;
    }

    return { recommendation_strength: strength, explanation, pros, cons };
  }

  /**
   * Compare les prix entre fournisseurs et calcule la compétitivité
   */
  async calculatePriceCompetitiveness(recommendations: SupplierRecommendation[]): Promise<SupplierRecommendation[]> {
    if (recommendations.length === 0) return recommendations;

    // Trouver le prix moyen du marché
    const avgMarketPrice = recommendations.reduce((sum, rec) => sum + rec.avg_price, 0) / recommendations.length;

    // Calculer la compétitivité pour chaque fournisseur
    for (const rec of recommendations) {
      if (avgMarketPrice > 0) {
        // Négatif = moins cher que la moyenne, Positif = plus cher
        rec.price_competitiveness = ((rec.avg_price - avgMarketPrice) / avgMarketPrice) * 100;
      }
    }

    return recommendations;
  }
}
