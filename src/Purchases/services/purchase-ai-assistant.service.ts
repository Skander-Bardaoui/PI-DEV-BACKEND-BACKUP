// src/Purchases/services/purchase-ai-assistant.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { SupplierPO } from '../entities/supplier-po.entity';
import { PurchaseInvoice } from '../entities/purchase-invoice.entity';
import { SupplierPayment } from '../../payments/entities/supplier-payment.entity';
import { parseGeminiJson } from '../utils/json-parser.util';

const EXAMPLE_QUESTIONS = [
  "Quel fournisseur m'a le plus facturé ce trimestre ?",
  "Y a-t-il des factures en retard ?",
  "Combien ai-je dépensé ce mois-ci ?",
  "Quels sont mes meilleurs fournisseurs ?",
  "Ai-je des litiges en cours ?",
  "Combien de commandes sont en attente ?",
  "Quels paiements ai-je effectués récemment ?",
  "Quel fournisseur livre le plus rapidement ?",
  "Combien de fournisseurs actifs ai-je ?",
  "Quelle est ma facture la plus élevée ?",
];

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QueryResult {
  answer: string;
  data?: any;
  suggestions?: string[];
  confidence: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}

@Injectable()
export class PurchaseAiAssistantService {
  private readonly logger = new Logger(PurchaseAiAssistantService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SupplierPO) private readonly poRepo: Repository<SupplierPO>,
    @InjectRepository(PurchaseInvoice) private readonly invoiceRepo: Repository<PurchaseInvoice>,
    @InjectRepository(SupplierPayment) private readonly paymentRepo: Repository<SupplierPayment>,
  ) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY', '');
  }

  async chat(businessId: string, question: string, history: ChatMessage[] = []): Promise<QueryResult> {
    if (!this.apiKey) {
      return {
        answer: 'L\'assistant IA n\'est pas configuré. Veuillez configurer la clé API Gemini.',
        confidence: 0,
        suggestions: ['Configurer l\'API Gemini dans les paramètres'],
      };
    }

    try {
      // 1. Analyser l'intention de la question
      const intent = await this.analyzeIntent(question);

      // 2. Récupérer les données pertinentes
      const data = await this.fetchRelevantData(businessId, intent);

      // 3. Générer la réponse avec l'IA
      const response = await this.generateResponse(question, data, history);

      return response;
    } catch (error: any) {
      this.logger.error(`Erreur chat IA: ${error.message}`);
      
      // Message d'erreur personnalisé selon le type d'erreur
      let errorMessage = 'Désolé, je n\'ai pas pu traiter votre question. Pouvez-vous la reformuler ?';
      
      if (error.message.includes('Limite de requêtes')) {
        errorMessage = 'Trop de requêtes en peu de temps. Veuillez patienter quelques secondes avant de réessayer.';
      } else if (error.message.includes('API error')) {
        errorMessage = 'Le service IA est temporairement indisponible. Veuillez réessayer dans un instant.';
      }
      
      return {
        answer: errorMessage,
        confidence: 0,
        suggestions: ['Réessayer dans quelques instants'],
      };
    }
  }

  private analyzeIntent(question: string): string {
    const q = question.toLowerCase();

    // Détection d'intentions simples
    if (q.includes('fournisseur') && (q.includes('facturé') || q.includes('dépensé'))) return 'top_suppliers_by_amount';
    if (q.includes('retard') || q.includes('impayé')) return 'overdue_invoices';
    if (q.includes('litige') || q.includes('dispute')) return 'disputed_invoices';
    if (q.includes('commande') && q.includes('attente')) return 'pending_orders';
    if (q.includes('paiement') && q.includes('effectué')) return 'recent_payments';
    if (q.includes('statistique') || q.includes('résumé')) return 'summary_stats';
    if (q.includes('meilleur') || q.includes('performance')) return 'best_suppliers';
    if (q.includes('économie') || q.includes('réduire')) return 'cost_optimization';

    return 'general_query';
  }

  private async fetchRelevantData(businessId: string, intent: string): Promise<any> {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    switch (intent) {
      case 'top_suppliers_by_amount':
        return this.getTopSuppliersByAmount(businessId, threeMonthsAgo, now);

      case 'overdue_invoices':
        return this.getOverdueInvoices(businessId);

      case 'disputed_invoices':
        return this.getDisputedInvoices(businessId);

      case 'pending_orders':
        return this.getPendingOrders(businessId);

      case 'recent_payments':
        return this.getRecentPayments(businessId, 30);

      case 'summary_stats':
        return this.getSummaryStats(businessId, threeMonthsAgo, now);

      case 'best_suppliers':
        return this.getBestSuppliers(businessId);

      default:
        return this.getGeneralData(businessId);
    }
  }

  private async getTopSuppliersByAmount(businessId: string, startDate: Date, endDate: Date) {
    const invoices = await this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.supplier', 'supplier')
      .where('inv.business_id = :businessId', { businessId })
      .andWhere('inv.invoice_date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const supplierTotals = new Map<string, { name: string; total: number; count: number }>();

    invoices.forEach(inv => {
      if (!inv.supplier) return;
      const key = inv.supplier.id;
      const existing = supplierTotals.get(key) || { name: inv.supplier.name, total: 0, count: 0 };
      // Utiliser net_amount qui inclut HT + TVA + timbre fiscal
      existing.total += Number(inv.net_amount);
      existing.count += 1;
      supplierTotals.set(key, existing);
    });

    return Array.from(supplierTotals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }

  private async getOverdueInvoices(businessId: string) {
    const now = new Date();
    return this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.supplier', 'supplier')
      .where('inv.business_id = :businessId', { businessId })
      .andWhere('inv.status IN (:...statuses)', { statuses: ['PENDING', 'OVERDUE'] })
      .andWhere('inv.due_date < :now', { now })
      .orderBy('inv.due_date', 'ASC')
      .take(20)
      .getMany();
  }

  private async getDisputedInvoices(businessId: string) {
    return this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.supplier', 'supplier')
      .where('inv.business_id = :businessId', { businessId })
      .andWhere('inv.status = :status', { status: 'DISPUTED' })
      .orderBy('inv.invoice_date', 'DESC')
      .take(20)
      .getMany();
  }

  private async getPendingOrders(businessId: string) {
    return this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .where('po.business_id = :businessId', { businessId })
      .andWhere('po.status IN (:...statuses)', { statuses: ['DRAFT', 'SENT', 'CONFIRMED'] })
      .orderBy('po.created_at', 'DESC')
      .take(20)
      .getMany();
  }

  private async getRecentPayments(businessId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.paymentRepo
      .createQueryBuilder('pay')
      .leftJoinAndSelect('pay.purchase_invoice', 'invoice')
      .leftJoinAndSelect('pay.supplier', 'supplier')
      .where('pay.business_id = :businessId', { businessId })
      .andWhere('pay.payment_date >= :since', { since })
      .orderBy('pay.payment_date', 'DESC')
      .take(20)
      .getMany();
  }

  private async getSummaryStats(businessId: string, startDate: Date, endDate: Date) {
    const [suppliers, invoices, payments, pos] = await Promise.all([
      this.supplierRepo.count({ where: { business_id: businessId, is_active: true } }),
      this.invoiceRepo.find({
        where: { business_id: businessId, invoice_date: Between(startDate, endDate) },
      }),
      this.paymentRepo.find({
        where: { business_id: businessId, payment_date: Between(startDate, endDate) },
      }),
      this.poRepo.count({ where: { business_id: businessId } }),
    ]);

    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.net_amount), 0);
    const totalPaid = payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
    const overdueCount = invoices.filter(inv => 
      inv.status === 'OVERDUE' || 
      (inv.status === 'PENDING' && new Date(inv.due_date) < new Date())
    ).length;

    return {
      suppliers_count: suppliers,
      invoices_count: invoices.length,
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      overdue_count: overdueCount,
      pos_count: pos,
    };
  }

  private async getBestSuppliers(businessId: string) {
    // Simplification: fournisseurs avec le plus de commandes
    const result = await this.poRepo
      .createQueryBuilder('po')
      .select('supplier.id', 'supplier_id')
      .addSelect('supplier.name', 'supplier_name')
      .addSelect('COUNT(po.id)', 'order_count')
      .leftJoin('po.supplier', 'supplier')
      .where('po.business_id = :businessId', { businessId })
      .groupBy('supplier.id')
      .addGroupBy('supplier.name')
      .orderBy('order_count', 'DESC')
      .limit(5)
      .getRawMany();

    return result;
  }

  private async getGeneralData(businessId: string) {
    return this.getSummaryStats(businessId, new Date(new Date().getFullYear(), 0, 1), new Date());
  }

  private async generateResponse(question: string, data: any, history: ChatMessage[]): Promise<QueryResult> {
    const conversationContext = history.length > 0
      ? `\n\nHistorique de conversation:\n${history.map(m => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`).join('\n')}`
      : '';

    const prompt = `Tu es un assistant IA spécialisé dans la gestion des achats et des fournisseurs.

QUESTION: ${question}

DONNÉES: ${JSON.stringify(data, null, 2)}
${conversationContext}

INSTRUCTIONS STRICTES:
1. Réponds en JSON valide UNIQUEMENT
2. Réponse ULTRA-COURTE (max 100 caractères)
3. Pas de sauts de ligne, pas de caractères spéciaux
4. Utilise les chiffres des données fournies
5. Format exact requis ci-dessous

EXEMPLE DE RÉPONSE VALIDE:
{"answer":"Vous avez 5 factures en retard pour un total de 1250 TND","suggestions":["Voir les details","Quels fournisseurs?"],"confidence":90}

RÉPONDS MAINTENANT (JSON uniquement):`;

    const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 256,
          topP: 0.9,
          topK: 20,
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Limite de requêtes atteinte. Veuillez réessayer dans quelques instants.');
      }
      throw new Error(`API error ${response.status}`);
    }

    const aiData: GeminiResponse = await response.json();
    const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) throw new Error('Réponse IA vide');

    // Nettoyage agressif avant parsing
    let cleanedText = aiText
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    // Extraire uniquement le JSON entre accolades
    const jsonMatch = cleanedText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }

    // Remplacer les sauts de ligne dans les valeurs par des espaces
    cleanedText = cleanedText.replace(/"answer"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g, (match, content) => {
      const cleaned = content
        .replace(/\\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return `"answer":"${cleaned}"`;
    });

    // Fonction pour extraire la réponse même si le JSON est incomplet
    const extractPartialAnswer = (text: string): string => {
      // Chercher "answer":"..." même si incomplet
      const patterns = [
        /"answer"\s*:\s*"([^"]*)"/,           // Cas normal
        /"answer"\s*:\s*"([^"]*)/,            // Guillemet non fermé
        /"answer"\s*:\s*([^,}]*)/,            // Sans guillemets
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      return '';
    };

    // Vérifier si le JSON est complet
    const isComplete = cleanedText.endsWith('}') && 
                       (cleanedText.match(/\{/g) || []).length === (cleanedText.match(/\}/g) || []).length;

    if (!isComplete) {
      this.logger.warn('JSON incomplet détecté, extraction de la réponse partielle');
      
      const partialAnswer = extractPartialAnswer(cleanedText);
      if (partialAnswer) {
        return {
          answer: partialAnswer,
          data,
          suggestions: ['Reformuler plus simplement', 'Poser une autre question'],
          confidence: 50,
        };
      }
    }

    try {
      const result = JSON.parse(cleanedText);
      return {
        answer: result.answer || 'Je n\'ai pas pu générer une réponse.',
        data,
        suggestions: Array.isArray(result.suggestions) ? result.suggestions.slice(0, 3) : [],
        confidence: typeof result.confidence === 'number' ? result.confidence : 50,
      };
    } catch (parseError) {
      this.logger.error(`Erreur parsing JSON: ${(parseError as Error).message}`);
      this.logger.debug(`JSON reçu: ${cleanedText.substring(0, 200)}`);
      
      // Fallback robuste: extraire manuellement
      const answer = extractPartialAnswer(cleanedText);
      
      if (answer) {
        return {
          answer,
          data,
          suggestions: ['Reformuler la question', 'Voir les statistiques'],
          confidence: 40,
        };
      }
      
      // Dernier recours
      return {
        answer: 'Désolé, je n\'ai pas pu traiter votre question. Veuillez la reformuler plus simplement.',
        data,
        suggestions: ['Combien ai-je dépensé ce mois ?', 'Quels sont mes fournisseurs actifs ?'],
        confidence: 0,
      };
    }
  }
}
