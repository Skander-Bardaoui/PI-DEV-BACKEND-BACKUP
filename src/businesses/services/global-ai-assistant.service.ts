// src/businesses/services/global-ai-assistant.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// Import entities from different modules
import { Invoice } from '../../sales/entities/invoice.entity';
import { SalesOrder } from '../../sales/entities/sales-order.entity';
import { Quote } from '../../sales/entities/quote.entity';
import { Client } from '../../sales/entities/client.entity';
import { SupplierPO } from '../../Purchases/entities/supplier-po.entity';
import { Supplier } from '../../Purchases/entities/supplier.entity';
import { Product } from '../../stock/entities/product.entity';
import { StockMovement } from '../../stock/entities/stock-movement.entity';
import { Task } from '../../collaboration/entities/task.entity';
import { BusinessMember } from '../entities/business-member.entity';
import { Transaction } from '../../payments/entities/transaction.entity';
import { Account } from '../../payments/entities/account.entity';

interface MessageDto {
  role: 'user' | 'assistant';
  content: string;
}

export interface GlobalQueryResult {
  answer: string;
  suggestions?: string[];
  sources?: string[];
}

@Injectable()
export class GlobalAiAssistantService {
  private readonly logger = new Logger(GlobalAiAssistantService.name);
  private readonly model: GenerativeModel | null;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(SalesOrder)
    private salesOrderRepo: Repository<SalesOrder>,
    @InjectRepository(Quote)
    private quoteRepo: Repository<Quote>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(SupplierPO)
    private supplierPoRepo: Repository<SupplierPO>,
    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(StockMovement)
    private stockMovementRepo: Repository<StockMovement>,
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    @InjectRepository(BusinessMember)
    private businessMemberRepo: Repository<BusinessMember>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(Account)
    private accountRepo: Repository<Account>,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY non configurée — assistant IA désactivé');
      this.model = null;
    } else {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        this.logger.log('Assistant IA global initialisé avec succès (Gemini 2.5 Flash)');
      } catch (error: any) {
        this.logger.error(`Erreur initialisation Gemini: ${error.message}`);
        this.model = null;
      }
    }
  }

  async chat(businessId: string, question: string, history: MessageDto[]): Promise<GlobalQueryResult> {
    try {
      this.logger.log(`Global AI chat for business ${businessId}: ${question}`);

      if (!this.model) {
        return this.getFallbackResponse(businessId, question);
      }

      // Gather comprehensive business data
      const context = await this.gatherBusinessContext(businessId, question);

      // Create conversation history for context
      const conversationHistory = history.slice(-5).map(msg => 
        `${msg.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${msg.content}`
      ).join('\n');

      // Create comprehensive prompt for Gemini
      const prompt = this.createComprehensivePrompt(question, context, conversationHistory);

      // Call Gemini API
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse the response
      const parsedResponse = this.parseGeminiResponse(responseText);

      return {
        answer: parsedResponse.answer || 'Je n\'ai pas pu générer une réponse complète.',
        suggestions: parsedResponse.suggestions || this.getDefaultSuggestions(question),
        sources: parsedResponse.sources || [],
      };
    } catch (error: any) {
      this.logger.error(`Global AI chat error: ${error?.message || 'Unknown error'}`, error?.stack);
      
      // Fallback to basic response
      return this.getFallbackResponse(businessId, question);
    }
  }

  private createComprehensivePrompt(question: string, context: any, conversationHistory: string): string {
    return `
Tu es un assistant IA intelligent pour une entreprise utilisant le système NovaEntra. Tu dois répondre de manière complète et précise aux questions sur les données de l'entreprise.

CONTEXTE DE L'ENTREPRISE:
${JSON.stringify(context, null, 2)}

HISTORIQUE DE CONVERSATION:
${conversationHistory}

QUESTION ACTUELLE: ${question}

INSTRUCTIONS:
1. Analyse toutes les données disponibles dans le contexte
2. Fournis une réponse complète et détaillée
3. Utilise des chiffres précis quand disponibles
4. Propose des suggestions pertinentes
5. Sois professionnel mais accessible

IMPORTANT: Réponds UNIQUEMENT avec ce format JSON (sans backticks):
{
  "answer": "Réponse complète et détaillée à la question",
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"],
  "sources": ["Source des données utilisées"]
}

La réponse doit être en français et adaptée au contexte business tunisien.
`;
  }

  private parseGeminiResponse(responseText: string): { answer?: string; suggestions?: string[]; sources?: string[] } {
    try {
      // Clean the response text
      const cleaned = responseText
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch (error) {
      this.logger.warn('Failed to parse Gemini JSON response, extracting manually');
      
      // Manual extraction as fallback
      const answerMatch = responseText.match(/"answer":\s*"([^"]+)"/);
      const suggestionsMatch = responseText.match(/"suggestions":\s*\[([^\]]+)\]/);
      
      return {
        answer: answerMatch ? answerMatch[1] : responseText.substring(0, 500),
        suggestions: suggestionsMatch ? 
          suggestionsMatch[1].split(',').map(s => s.trim().replace(/"/g, '')) : 
          this.getDefaultSuggestions(''),
        sources: ['Données de l\'entreprise']
      };
    }
  }

  private async gatherBusinessContext(businessId: string, question: string): Promise<any> {
    const lowerQuestion = question.toLowerCase();
    const context: any = {};

    try {
      // Always gather basic stats for comprehensive responses
      const [invoiceStats, orderStats, productStats, taskStats, teamStats, treasuryStats] = await Promise.all([
        this.getInvoiceStats(businessId),
        this.getOrderStats(businessId),
        this.getProductStats(businessId),
        this.getTaskStats(businessId),
        this.getTeamStats(businessId),
        this.getTreasuryStats(businessId)
      ]);

      context.summary = {
        invoices: invoiceStats,
        orders: orderStats,
        products: productStats,
        tasks: taskStats,
        team: teamStats,
        treasury: treasuryStats
      };

      // Sales data - gather more detailed data if question is about sales
      if (this.isAboutSales(lowerQuestion)) {
        const [invoices, orders, quotes, clients] = await Promise.all([
          this.invoiceRepo.find({
            where: { business_id: businessId },
            order: { created_at: 'DESC' },
            take: 100,
          }),
          this.salesOrderRepo.find({
            where: { businessId },
            order: { createdAt: 'DESC' },
            take: 100,
          }),
          this.quoteRepo.find({
            where: { businessId },
            order: { createdAt: 'DESC' },
            take: 50,
          }),
          this.clientRepo.find({
            where: { business_id: businessId },
            take: 100,
          }),
        ]);

        context.sales = {
          invoices: invoices.map(inv => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            status: inv.status,
            total_amount: inv.total_ttc,
            paid_amount: inv.paid_amount,
            due_date: inv.due_date,
            created_at: inv.created_at
          })),
          orders: orders.map(ord => ({
            id: ord.id,
            order_number: ord.orderNumber,
            status: ord.status,
            total_amount: ord.total,
            created_at: ord.createdAt,
          })),
          quotes: quotes.map(q => ({
            id: q.id,
            quote_number: q.quoteNumber,
            status: q.status,
            total_amount: q.total,
            created_at: q.createdAt,
          })),
          clients: clients.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
          })),
        };
      }

      // Purchase data
      if (this.isAboutPurchases(lowerQuestion)) {
        const [purchaseOrders, suppliers] = await Promise.all([
          this.supplierPoRepo.find({
            where: { business_id: businessId },
            order: { created_at: 'DESC' },
            take: 100,
          }),
          this.supplierRepo.find({
            where: { business_id: businessId },
            take: 100,
          }),
        ]);

        context.purchases = {
          orders: purchaseOrders.map(po => ({
            id: po.id,
            po_number: po.po_number,
            status: po.status,
            total_amount: po.net_amount,
            created_at: po.created_at,
          })),
          suppliers: suppliers.map(s => ({
            id: s.id,
            name: s.name,
            email: s.email,
          })),
        };
      }

      // Stock data
      if (this.isAboutStock(lowerQuestion)) {
        const [products, movements] = await Promise.all([
          this.productRepo.find({
            where: { business_id: businessId },
            take: 200,
          }),
          this.stockMovementRepo.find({
            where: { business_id: businessId },
            order: { created_at: 'DESC' },
            take: 100,
          }),
        ]);

        context.stock = {
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            quantity: p.quantity,
            reserved_quantity: p.reserved_quantity,
            price: p.price,
            category: p.category
          })),
          movements: movements.map(m => ({
            id: m.id,
            type: m.type,
            quantity: m.quantity,
            created_at: m.created_at,
          })),
        };
      }

      // Collaboration/Team data
      if (this.isAboutCollaboration(lowerQuestion)) {
        const [tasks, teamMembers] = await Promise.all([
          this.taskRepo.find({
            where: { businessId },
            order: { createdAt: 'DESC' },
            take: 100,
            relations: ['assignedTo', 'createdBy']
          }),
          this.businessMemberRepo.find({
            where: { business_id: businessId },
            relations: ['user'],
            take: 100,
          }),
        ]);

        context.collaboration = {
          tasks: tasks.map(task => ({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            assigned_to: task.assignedTo ? `${task.assignedTo.firstName || ''} ${task.assignedTo.lastName || ''}`.trim() || task.assignedTo.email : 'Non assigné',
            created_by: task.createdBy ? `${task.createdBy.firstName || ''} ${task.createdBy.lastName || ''}`.trim() || task.createdBy.email : 'Système',
            due_date: task.dueDate,
            created_at: task.createdAt,
          })),
          team_members: teamMembers.map(member => ({
            id: member.id,
            user_name: member.user ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim() || member.user.email : 'Utilisateur',
            role: member.role,
            joined_at: member.joined_at,
            is_active: member.is_active,
          })),
        };
      }

      // Treasury data
      if (this.isAboutTreasury(lowerQuestion)) {
        const [transactions, accounts] = await Promise.all([
          this.transactionRepo.find({
            where: { business_id: businessId },
            order: { transaction_date: 'DESC' },
            take: 100,
            relations: ['account']
          }),
          this.accountRepo.find({
            where: { business_id: businessId },
            take: 50,
          }),
        ]);

        context.treasury = {
          transactions: transactions.map(trans => ({
            id: trans.id,
            type: trans.type,
            amount: trans.amount,
            transaction_date: trans.transaction_date,
            description: trans.description,
            account_name: trans.account?.name || 'Compte inconnu',
            is_reconciled: trans.is_reconciled,
          })),
          accounts: accounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            type: acc.type,
            balance: acc.current_balance,
            is_active: acc.is_active,
            is_default: acc.is_default,
          })),
        };
      }

      return context;
    } catch (error: any) {
      this.logger.error(`Error gathering context: ${error?.message || 'Unknown error'}`);
      return context;
    }
  }

  private async getInvoiceStats(businessId: string) {
    try {
      const [total, paid, pending, overdue] = await Promise.all([
        this.invoiceRepo.count({ where: { business_id: businessId } }),
        this.invoiceRepo.count({ where: { business_id: businessId, status: 'PAID' as any } }),
        this.invoiceRepo.count({ where: { business_id: businessId, status: 'PENDING' as any } }),
        this.invoiceRepo.count({ where: { business_id: businessId, status: 'OVERDUE' as any } })
      ]);

      const totalAmount = await this.invoiceRepo
        .createQueryBuilder('invoice')
        .select('SUM(invoice.total_ttc)', 'sum')
        .where('invoice.business_id = :businessId', { businessId })
        .getRawOne();

      const paidAmount = await this.invoiceRepo
        .createQueryBuilder('invoice')
        .select('SUM(invoice.paid_amount)', 'sum')
        .where('invoice.business_id = :businessId', { businessId })
        .getRawOne();

      return {
        total,
        paid,
        pending,
        overdue,
        totalAmount: parseFloat(totalAmount?.sum || '0'),
        paidAmount: parseFloat(paidAmount?.sum || '0')
      };
    } catch (error) {
      return { total: 0, paid: 0, pending: 0, overdue: 0, totalAmount: 0, paidAmount: 0 };
    }
  }

  private async getOrderStats(businessId: string) {
    try {
      const [total, confirmed, pending] = await Promise.all([
        this.salesOrderRepo.count({ where: { businessId } }),
        this.salesOrderRepo.count({ where: { businessId, status: 'CONFIRMED' as any } }),
        this.salesOrderRepo.count({ where: { businessId, status: 'PENDING' as any } })
      ]);

      return { total, confirmed, pending };
    } catch (error) {
      return { total: 0, confirmed: 0, pending: 0 };
    }
  }

  private async getProductStats(businessId: string) {
    try {
      const [total, lowStock] = await Promise.all([
        this.productRepo.count({ where: { business_id: businessId } }),
        this.productRepo.count({ 
          where: { 
            business_id: businessId 
            // Add low stock condition if you have a minimum stock field
          } 
        })
      ]);

      return { total, lowStock };
    } catch (error) {
      return { total: 0, lowStock: 0 };
    }
  }

  private async getTaskStats(businessId: string) {
    try {
      const [total, todo, inProgress, done, urgent] = await Promise.all([
        this.taskRepo.count({ where: { businessId } }),
        this.taskRepo.count({ where: { businessId, status: 'TODO' as any } }),
        this.taskRepo.count({ where: { businessId, status: 'IN_PROGRESS' as any } }),
        this.taskRepo.count({ where: { businessId, status: 'DONE' as any } }),
        this.taskRepo.count({ where: { businessId, priority: 'URGENT' as any } })
      ]);

      return { total, todo, inProgress, done, urgent };
    } catch (error) {
      return { total: 0, todo: 0, inProgress: 0, done: 0, urgent: 0 };
    }
  }

  private async getTeamStats(businessId: string) {
    try {
      const [total, active] = await Promise.all([
        this.businessMemberRepo.count({ where: { business_id: businessId } }),
        this.businessMemberRepo.count({ where: { business_id: businessId, is_active: true } })
      ]);

      return { total, active, inactive: total - active };
    } catch (error) {
      return { total: 0, active: 0, inactive: 0 };
    }
  }

  private async getTreasuryStats(businessId: string) {
    try {
      const [totalTransactions, totalAccounts] = await Promise.all([
        this.transactionRepo.count({ where: { business_id: businessId } }),
        this.accountRepo.count({ where: { business_id: businessId, is_active: true } })
      ]);

      // Calculate total balance
      const balanceResult = await this.accountRepo
        .createQueryBuilder('account')
        .select('SUM(account.current_balance)', 'sum')
        .where('account.business_id = :businessId', { businessId })
        .andWhere('account.is_active = :isActive', { isActive: true })
        .getRawOne();

      const totalBalance = parseFloat(balanceResult?.sum || '0');

      return { totalTransactions, totalAccounts, totalBalance };
    } catch (error) {
      return { totalTransactions: 0, totalAccounts: 0, totalBalance: 0 };
    }
  }

  private isAboutSales(question: string): boolean {
    const salesKeywords = [
      'vente', 'facture', 'client', 'devis', 'commande client', 'chiffre',
      'revenue', 'invoice', 'sales', 'quote', 'customer', 'payé', 'paiement',
    ];
    return salesKeywords.some(keyword => question.includes(keyword));
  }

  private isAboutPurchases(question: string): boolean {
    const purchaseKeywords = [
      'achat', 'fournisseur', 'commande fournisseur', 'purchase', 'supplier',
      'bon de commande', 'po', 'approvisionnement',
    ];
    return purchaseKeywords.some(keyword => question.includes(keyword));
  }

  private isAboutStock(question: string): boolean {
    const stockKeywords = [
      'stock', 'produit', 'inventaire', 'entrepôt', 'warehouse', 'product',
      'inventory', 'quantité', 'rupture',
    ];
    return stockKeywords.some(keyword => question.includes(keyword));
  }

  private isAboutCollaboration(question: string): boolean {
    const collaborationKeywords = [
      'tâche', 'task', 'équipe', 'team', 'collaboration', 'membre', 'member',
      'assigné', 'assigned', 'projet', 'project', 'travail', 'work', 'todo',
      'en cours', 'terminé', 'completed', 'urgent', 'priorité', 'priority'
    ];
    return collaborationKeywords.some(keyword => question.includes(keyword));
  }

  private isAboutTreasury(question: string): boolean {
    const treasuryKeywords = [
      'trésorerie', 'treasury', 'compte', 'account', 'transaction', 'solde',
      'balance', 'banque', 'bank', 'caisse', 'cash', 'paiement', 'payment',
      'virement', 'transfer', 'chèque', 'check', 'espèces', 'liquidité'
    ];
    return treasuryKeywords.some(keyword => question.includes(keyword));
  }

  private async getFallbackResponse(businessId: string, question: string): Promise<GlobalQueryResult> {
    const lowerQuestion = question.toLowerCase();

    try {
      // Simple sales invoice count
      if (lowerQuestion.includes('facture') && (lowerQuestion.includes('payé') || lowerQuestion.includes('paiement'))) {
        const paidCount = await this.invoiceRepo.count({
          where: { business_id: businessId, status: 'PAID' as any },
        });
        const totalCount = await this.invoiceRepo.count({
          where: { business_id: businessId },
        });

        return {
          answer: `Vous avez ${paidCount} facture(s) payée(s) sur un total de ${totalCount} facture(s) de vente.`,
          suggestions: [
            'Quel est mon chiffre d\'affaires ce mois-ci ?',
            'Combien de factures sont en retard ?',
            'Quels sont mes meilleurs clients ?',
          ],
        };
      }

      // Simple task count
      if (lowerQuestion.includes('tâche') || lowerQuestion.includes('task')) {
        const taskStats = await this.getTaskStats(businessId);
        return {
          answer: `Vous avez ${taskStats.total} tâche(s) au total : ${taskStats.todo} à faire, ${taskStats.inProgress} en cours, ${taskStats.done} terminées. ${taskStats.urgent} tâche(s) sont marquées comme urgentes.`,
          suggestions: [
            'Quelles sont les tâches urgentes ?',
            'Qui travaille sur quoi ?',
            'Combien de tâches sont en retard ?',
          ],
        };
      }

      // Simple team count
      if (lowerQuestion.includes('équipe') || lowerQuestion.includes('team') || lowerQuestion.includes('membre')) {
        const teamStats = await this.getTeamStats(businessId);
        return {
          answer: `Votre équipe compte ${teamStats.total} membre(s) au total, dont ${teamStats.active} actif(s) et ${teamStats.inactive} inactif(s).`,
          suggestions: [
            'Qui sont les membres actifs ?',
            'Quelles sont les permissions de l\'équipe ?',
            'Combien de tâches par membre ?',
          ],
        };
      }

      // Simple treasury info
      if (lowerQuestion.includes('trésorerie') || lowerQuestion.includes('solde') || lowerQuestion.includes('compte')) {
        const treasuryStats = await this.getTreasuryStats(businessId);
        return {
          answer: `Vous avez ${treasuryStats.totalAccounts} compte(s) actif(s) avec un solde total de ${treasuryStats.totalBalance.toFixed(3)} TND. ${treasuryStats.totalTransactions} transaction(s) enregistrées.`,
          suggestions: [
            'Quelles sont mes dernières transactions ?',
            'Quel est le solde par compte ?',
            'Combien de paiements en attente ?',
          ],
        };
      }

      // Generic fallback
      return {
        answer: 'Je n\'ai pas pu traiter votre question. Pouvez-vous la reformuler ou être plus précis ?',
        suggestions: [
          'Combien de factures de vente sont payées ?',
          'Quel est l\'état de mon stock ?',
          'Combien de tâches sont en cours ?',
          'Qui sont les membres de mon équipe ?',
          'Quel est mon solde de trésorerie ?',
        ],
      };
    } catch (error: any) {
      this.logger.error(`Fallback response error: ${error?.message || 'Unknown error'}`);
      return {
        answer: 'Désolé, une erreur s\'est produite. Veuillez réessayer.',
        suggestions: ['Réessayer'],
      };
    }
  }

  private getDefaultSuggestions(question: string): string[] {
    return [
      'Quel est mon chiffre d\'affaires ce mois-ci ?',
      'Combien de factures sont en retard ?',
      'Quel est l\'état de mon stock ?',
      'Combien de tâches sont en cours ?',
      'Qui sont les membres actifs de mon équipe ?',
      'Quel est mon solde de trésorerie ?',
      'Quelles sont les tâches urgentes ?',
      'Combien de transactions ce mois ?'
    ];
  }
}
