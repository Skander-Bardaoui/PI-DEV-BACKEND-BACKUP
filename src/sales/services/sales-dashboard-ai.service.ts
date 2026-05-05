import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { RecurringInvoice, RecurringFrequency } from '../entities/recurring-invoice.entity';
import { Quote, QuoteStatus } from '../entities/quote.entity';
import { SalesOrder } from '../entities/sales-order.entity';

export interface AiForecastResult {
  predictedRevenue: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  churnRisks: ChurnRisk[];
  summary: string;
  recommendations: string[];
}

export interface ChurnRisk {
  clientId: string;
  clientName: string;
  lastOrderDate: string;
  orderFrequencyDrop: number;  // % de baisse
  riskLevel: 'HIGH' | 'MEDIUM';
}

@Injectable()
export class SalesDashboardAiService {
  private readonly logger = new Logger(SalesDashboardAiService.name);
  private readonly model: GenerativeModel | null;

  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(RecurringInvoice) private recurringRepo: Repository<RecurringInvoice>,
    @InjectRepository(Quote) private quoteRepo: Repository<Quote>,
    @InjectRepository(SalesOrder) private orderRepo: Repository<SalesOrder>,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY non configurée — prévisions AI désactivées');
      this.model = null;
    } else {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Utiliser gemini-1.5-flash (plus stable et moins de surcharge que 2.5)
        this.model = genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        });
        this.logger.log('Service dashboard AI initialisé avec succès (gemini-1.5-flash)');
      } catch (error: any) {
        this.logger.error(`Erreur lors de l'initialisation de Gemini: ${error.message}`);
        this.model = null;
      }
    }
  }

  async generateForecast(businessId: string): Promise<AiForecastResult> {
    // ── 1. Collecter les données ──────────────────────────
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    // Factures payées des 3 derniers mois
    const recentInvoices = await this.invoiceRepo.find({
      where: { 
        business_id: businessId, 
        status: InvoiceStatus.PAID,
        date: Between(threeMonthsAgo, now) 
      },
      relations: ['client'],
    });

    // Factures récurrentes actives
    const recurringInvoices = await this.recurringRepo.find({
      where: { business_id: businessId, is_active: true },
    });

    // Devis ouverts (SENT)
    const openQuotes = await this.quoteRepo.find({
      where: { businessId, status: QuoteStatus.SENT },
      relations: ['client'],
    });

    // Commandes par client pour détecter churn
    const recentOrders = await this.orderRepo.find({
      where: { businessId, orderDate: Between(threeMonthsAgo, now) },
      relations: ['client'],
    });

    // ── 2. Construire le contexte pour Gemini ─────────────
    const recurringMonthly = recurringInvoices
      .filter(r => r.frequency === RecurringFrequency.MONTHLY)
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const avgMonthlyRevenue = recentInvoices.length > 0
      ? recentInvoices.reduce((sum, inv) => sum + Number(inv.net_amount || 0), 0) / 3
      : 0;

    const openQuotesTotal = openQuotes
      .reduce((sum, q) => sum + Number(q.netAmount || 0), 0);

    // Grouper commandes par client
    const clientOrderMap = new Map<string, { name: string; dates: Date[] }>();
    for (const order of recentOrders) {
      const key = order.clientId;
      if (!clientOrderMap.has(key)) {
        clientOrderMap.set(key, { name: order.client?.name ?? key, dates: [] });
      }
      clientOrderMap.get(key)!.dates.push(new Date(order.orderDate));
    }

    const context = {
      recurringMonthlyRevenue: recurringMonthly,
      averageMonthlyRevenue: avgMonthlyRevenue,
      openQuotesTotal,
      openQuotesCount: openQuotes.length,
      recurringCount: recurringInvoices.length,
      clientActivity: Array.from(clientOrderMap.entries()).map(([id, v]) => ({
        clientId: id,
        clientName: v.name,
        orderCount: v.dates.length,
        lastOrder: v.dates.sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString().split('T')[0],
      })),
    };

    // ── 3. Appel Gemini ou Fallback ──────────────────────
    if (!this.model) {
      this.logger.warn('Gemini AI non disponible - retour prévision basique');
      return this.generateFallbackForecast(context, recurringMonthly, avgMonthlyRevenue, openQuotesTotal, openQuotes.length);
    }

    const prompt = `
Tu es un analyste financier senior pour une PME (Tunisie).
Basé sur ces données des 3 derniers mois, génère une prévision.
Réponds UNIQUEMENT en JSON valide (sans backticks):

Données: ${JSON.stringify(context, null, 2)}

{
  "predictedRevenue": 15000.000,
  "confidence": "HIGH",
  "churnRisks": [
    {
      "clientId": "uuid",
      "clientName": "Client X",
      "lastOrderDate": "2025-01-15",
      "orderFrequencyDrop": 60,
      "riskLevel": "HIGH"
    }
  ],
  "summary": "Phrase résumant les tendances et prévisions du mois prochain.",
  "recommendations": [
    "Relancer les 3 devis ouverts avant fin de mois",
    "Contacter Client X qui n'a pas commandé depuis 6 semaines"
  ]
}
    `;

    try {
      // Retry logic avec backoff exponentiel
      let lastError: Error | null = null;
      const maxRetries = 2;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            // Attendre avant de réessayer (1s, 2s)
            const delay = Math.pow(2, attempt - 1) * 1000;
            this.logger.log(`Tentative ${attempt + 1}/${maxRetries + 1} après ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          const result = await this.model.generateContent(prompt);
          const text = result.response.text().replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(text);
          
          this.logger.log(`Prévision AI générée - Revenue prédit: ${parsed.predictedRevenue} DT`);
          
          return parsed;
        } catch (err: any) {
          lastError = err;
          
          // Si c'est une erreur 503 (service surchargé), on réessaye
          if (err.message?.includes('503') || err.message?.includes('high demand')) {
            this.logger.warn(`Gemini API surchargée (tentative ${attempt + 1}/${maxRetries + 1})`);
            if (attempt < maxRetries) continue;
          }
          
          // Pour les autres erreurs, on arrête immédiatement
          break;
        }
      }
      
      // Si toutes les tentatives ont échoué
      this.logger.error(`Erreur lors de la génération de prévision AI après ${maxRetries + 1} tentatives: ${lastError?.message}`);
      this.logger.log('Utilisation du mode de prévision de secours (calcul statistique)');
      return this.generateFallbackForecast(context, recurringMonthly, avgMonthlyRevenue, openQuotesTotal, openQuotes.length);
      
    } catch (error: any) {
      this.logger.error(`Erreur inattendue lors de la génération de prévision AI: ${error.message}`);
      return this.generateFallbackForecast(context, recurringMonthly, avgMonthlyRevenue, openQuotesTotal, openQuotes.length);
    }
  }

  private generateFallbackForecast(
    context: any,
    recurringMonthly: number,
    avgMonthlyRevenue: number,
    openQuotesTotal: number,
    openQuotesCount: number,
  ): AiForecastResult {
    // Calcul simple: revenu récurrent + 30% du revenu moyen + 20% des devis ouverts
    const predictedRevenue = recurringMonthly + (avgMonthlyRevenue * 0.3) + (openQuotesTotal * 0.2);
    
    // Détection basique de churn: clients qui n'ont pas commandé depuis 60 jours
    const churnRisks: ChurnRisk[] = [];
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    for (const client of context.clientActivity) {
      const lastOrderDate = new Date(client.lastOrder);
      const daysSinceLastOrder = Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastOrder > 60) {
        churnRisks.push({
          clientId: client.clientId,
          clientName: client.clientName,
          lastOrderDate: client.lastOrder,
          orderFrequencyDrop: Math.min(100, Math.floor((daysSinceLastOrder / 90) * 100)),
          riskLevel: daysSinceLastOrder > 90 ? 'HIGH' : 'MEDIUM',
        });
      }
    }

    const recommendations: string[] = [];
    
    if (openQuotesCount > 0) {
      recommendations.push(`Relancer les ${openQuotesCount} devis ouverts (potentiel: ${openQuotesTotal.toFixed(3)} TND)`);
    }
    
    if (churnRisks.length > 0) {
      recommendations.push(`Contacter ${churnRisks.length} client(s) inactif(s) depuis plus de 60 jours`);
    }
    
    if (recurringMonthly > 0) {
      recommendations.push(`Maintenir les ${context.recurringCount} factures récurrentes actives`);
    }
    
    if (avgMonthlyRevenue > 0) {
      const growth = ((avgMonthlyRevenue - recurringMonthly) / avgMonthlyRevenue * 100).toFixed(1);
      recommendations.push(`Revenu moyen mensuel: ${avgMonthlyRevenue.toFixed(3)} TND (croissance: ${growth}%)`);
    }

    return {
      predictedRevenue: Math.round(predictedRevenue * 1000) / 1000,
      confidence: 'MEDIUM',
      churnRisks: churnRisks.slice(0, 5), // Top 5 risques
      summary: `Prévision basée sur l'analyse des données: revenu récurrent de ${recurringMonthly.toFixed(3)} TND, moyenne mensuelle de ${avgMonthlyRevenue.toFixed(3)} TND, et ${openQuotesCount} devis en attente.`,
      recommendations,
    };
  }
}
