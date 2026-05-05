import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { GlobalAiAssistantService } from './global-ai-assistant.service';
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

describe('GlobalAiAssistantService', () => {
  let service: GlobalAiAssistantService;
  let invoiceRepo: any;
  let salesOrderRepo: any;
  let productRepo: any;
  let taskRepo: any;
  let businessMemberRepo: any;
  let transactionRepo: any;
  let accountRepo: any;

  const createMockRepository = () => ({
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
    })),
  });

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalAiAssistantService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(SalesOrder),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Quote),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Client),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(SupplierPO),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Supplier),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Product),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(StockMovement),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Task),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(BusinessMember),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Account),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<GlobalAiAssistantService>(GlobalAiAssistantService);
    
    // Get repository instances
    invoiceRepo = module.get(getRepositoryToken(Invoice));
    salesOrderRepo = module.get(getRepositoryToken(SalesOrder));
    productRepo = module.get(getRepositoryToken(Product));
    taskRepo = module.get(getRepositoryToken(Task));
    businessMemberRepo = module.get(getRepositoryToken(BusinessMember));
    transactionRepo = module.get(getRepositoryToken(Transaction));
    accountRepo = module.get(getRepositoryToken(Account));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Initialization', () => {
    it('should initialize without Gemini API key', () => {
      mockConfigService.get.mockReturnValue(undefined);
      
      // Service should still be created even without API key
      expect(service).toBeDefined();
    });

    it('should initialize with Gemini API key', () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      
      expect(service).toBeDefined();
    });
  });

  describe('chat - Fallback responses', () => {
    it('should return fallback response for invoice payment question', async () => {
      const businessId = 'business-123';
      const question = 'Combien de factures sont payées ?';
      const history = [];

      invoiceRepo.count
        .mockResolvedValueOnce(15) // paid count
        .mockResolvedValueOnce(25); // total count

      const result = await service.chat(businessId, question, history);

      expect(result).toHaveProperty('answer');
      expect(result.answer).toContain('15');
      expect(result.answer).toContain('25');
      expect(result).toHaveProperty('suggestions');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toBeInstanceOf(Array);
    });

    it('should return fallback response for task question', async () => {
      const businessId = 'business-123';
      const question = 'Combien de tâches ai-je ?';
      const history = [];

      taskRepo.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(10) // todo
        .mockResolvedValueOnce(15) // in progress
        .mockResolvedValueOnce(25) // done
        .mockResolvedValueOnce(5); // urgent

      const result = await service.chat(businessId, question, history);

      expect(result).toHaveProperty('answer');
      expect(result.answer).toContain('50');
      expect(result.answer).toContain('10');
      expect(result.answer).toContain('15');
      expect(result.answer).toContain('25');
      expect(result.answer).toContain('5');
    });

    it('should return fallback response for team question', async () => {
      const businessId = 'business-123';
      const question = 'Combien de membres dans mon équipe ?';
      const history = [];

      businessMemberRepo.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // active

      const result = await service.chat(businessId, question, history);

      expect(result).toHaveProperty('answer');
      expect(result.answer).toContain('10');
      expect(result.answer).toContain('8');
      expect(result.answer).toContain('2'); // inactive
    });

    it('should return fallback response for treasury question', async () => {
      const businessId = 'business-123';
      const question = 'Quel est mon solde de trésorerie ?';
      const history = [];

      transactionRepo.count.mockResolvedValue(100);
      accountRepo.count.mockResolvedValue(3);
      
      const qb = accountRepo.createQueryBuilder();
      qb.getRawOne.mockResolvedValue({ sum: '50000.500' });

      const result = await service.chat(businessId, question, history);

      expect(result).toHaveProperty('answer');
      expect(result.answer).toContain('3');
      expect(result.answer).toContain('50000.500');
      expect(result.answer).toContain('100');
    });

    it('should return generic fallback for unrecognized question', async () => {
      const businessId = 'business-123';
      const question = 'Question non reconnue';
      const history = [];

      const result = await service.chat(businessId, question, history);

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('suggestions');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });
  });

  describe('Keyword detection', () => {
    it('should detect sales-related questions', () => {
      const salesQuestions = [
        'Combien de factures ?',
        'Quel est mon chiffre d\'affaires ?',
        'Liste des clients',
        'Devis en attente',
      ];

      salesQuestions.forEach(question => {
        const result = service['isAboutSales'](question.toLowerCase());
        expect(result).toBe(true);
      });
    });

    it('should detect purchase-related questions', () => {
      const purchaseQuestions = [
        'Commandes fournisseur',
        'Liste des fournisseurs',
        'Bon de commande',
        'Achats du mois',
      ];

      purchaseQuestions.forEach(question => {
        const result = service['isAboutPurchases'](question.toLowerCase());
        expect(result).toBe(true);
      });
    });

    it('should detect stock-related questions', () => {
      const stockQuestions = [
        'État du stock',
        'Produits en rupture',
        'Inventaire',
        'Quantité disponible',
      ];

      stockQuestions.forEach(question => {
        const result = service['isAboutStock'](question.toLowerCase());
        expect(result).toBe(true);
      });
    });

    it('should detect collaboration-related questions', () => {
      const collaborationQuestions = [
        'Tâches en cours',
        'Membres de l\'équipe',
        'Tâches urgentes',
        'Qui travaille sur quoi ?',
      ];

      collaborationQuestions.forEach(question => {
        const result = service['isAboutCollaboration'](question.toLowerCase());
        expect(result).toBe(true);
      });
    });

    it('should detect treasury-related questions', () => {
      const treasuryQuestions = [
        'Solde de trésorerie',
        'Transactions bancaires',
        'Comptes actifs',
        'Paiements en attente',
      ];

      treasuryQuestions.forEach(question => {
        const result = service['isAboutTreasury'](question.toLowerCase());
        expect(result).toBe(true);
      });
    });
  });

  describe('Statistics gathering', () => {
    it('should gather invoice statistics', async () => {
      const businessId = 'business-123';

      invoiceRepo.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60) // paid
        .mockResolvedValueOnce(30) // pending
        .mockResolvedValueOnce(10); // overdue

      const qb1 = invoiceRepo.createQueryBuilder();
      qb1.getRawOne.mockResolvedValueOnce({ sum: '150000' }); // total amount

      const qb2 = invoiceRepo.createQueryBuilder();
      qb2.getRawOne.mockResolvedValueOnce({ sum: '90000' }); // paid amount

      const stats = await service['getInvoiceStats'](businessId);

      expect(stats.total).toBe(100);
      expect(stats.paid).toBe(60);
      expect(stats.pending).toBe(30);
      expect(stats.overdue).toBe(10);
      expect(stats.totalAmount).toBe(150000);
      expect(stats.paidAmount).toBe(90000);
    });

    it('should gather order statistics', async () => {
      const businessId = 'business-123';

      salesOrderRepo.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(35) // confirmed
        .mockResolvedValueOnce(15); // pending

      const stats = await service['getOrderStats'](businessId);

      expect(stats.total).toBe(50);
      expect(stats.confirmed).toBe(35);
      expect(stats.pending).toBe(15);
    });

    it('should gather product statistics', async () => {
      const businessId = 'business-123';

      productRepo.count
        .mockResolvedValueOnce(200) // total
        .mockResolvedValueOnce(15); // low stock

      const stats = await service['getProductStats'](businessId);

      expect(stats.total).toBe(200);
      expect(stats.lowStock).toBe(15);
    });

    it('should gather task statistics', async () => {
      const businessId = 'business-123';

      taskRepo.count
        .mockResolvedValueOnce(80) // total
        .mockResolvedValueOnce(20) // todo
        .mockResolvedValueOnce(30) // in progress
        .mockResolvedValueOnce(30) // done
        .mockResolvedValueOnce(10); // urgent

      const stats = await service['getTaskStats'](businessId);

      expect(stats.total).toBe(80);
      expect(stats.todo).toBe(20);
      expect(stats.inProgress).toBe(30);
      expect(stats.done).toBe(30);
      expect(stats.urgent).toBe(10);
    });

    it('should gather team statistics', async () => {
      const businessId = 'business-123';

      businessMemberRepo.count
        .mockResolvedValueOnce(12) // total
        .mockResolvedValueOnce(10); // active

      const stats = await service['getTeamStats'](businessId);

      expect(stats.total).toBe(12);
      expect(stats.active).toBe(10);
      expect(stats.inactive).toBe(2);
    });

    it('should gather treasury statistics', async () => {
      const businessId = 'business-123';

      transactionRepo.count.mockResolvedValue(250);
      accountRepo.count.mockResolvedValue(5);

      const qb = accountRepo.createQueryBuilder();
      qb.getRawOne.mockResolvedValue({ sum: '75000.750' });

      const stats = await service['getTreasuryStats'](businessId);

      expect(stats.totalTransactions).toBe(250);
      expect(stats.totalAccounts).toBe(5);
      expect(stats.totalBalance).toBe(75000.750);
    });

    it('should handle errors in statistics gathering', async () => {
      const businessId = 'business-123';

      invoiceRepo.count.mockRejectedValue(new Error('Database error'));

      const stats = await service['getInvoiceStats'](businessId);

      expect(stats.total).toBe(0);
      expect(stats.paid).toBe(0);
      expect(stats.totalAmount).toBe(0);
    });
  });

  describe('Default suggestions', () => {
    it('should return default suggestions', () => {
      const suggestions = service['getDefaultSuggestions']('test question');

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('Quel est mon chiffre d\'affaires ce mois-ci ?');
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully in chat', async () => {
      const businessId = 'business-123';
      const question = 'Test question';
      const history = [];

      invoiceRepo.count.mockRejectedValue(new Error('Database error'));

      const result = await service.chat(businessId, question, history);

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('suggestions');
    });

    it('should return error message on complete failure', async () => {
      const businessId = 'business-123';
      const question = 'Test question';
      const history = [];

      // Mock all repositories to throw errors
      invoiceRepo.count.mockRejectedValue(new Error('Error'));
      taskRepo.count.mockRejectedValue(new Error('Error'));
      businessMemberRepo.count.mockRejectedValue(new Error('Error'));
      accountRepo.count.mockRejectedValue(new Error('Error'));

      const result = await service.chat(businessId, question, history);

      expect(result).toHaveProperty('answer');
      expect(result.answer).toContain('Désolé');
    });
  });

  describe('Conversation history', () => {
    it('should handle conversation history', async () => {
      const businessId = 'business-123';
      const question = 'Combien de factures ?';
      const history = [
        { role: 'user' as const, content: 'Bonjour' },
        { role: 'assistant' as const, content: 'Bonjour, comment puis-je vous aider ?' },
        { role: 'user' as const, content: 'Je veux des informations sur mes ventes' },
      ];

      invoiceRepo.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(20);

      const result = await service.chat(businessId, question, history);

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('suggestions');
    });
  });
});
