import { Test, TestingModule } from '@nestjs/testing';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from '../services/stock-movements/stock-movements.service';
import { StockMovementType } from '../enums/stock-movement-type.enum';

describe('StockMovementsController', () => {
  let controller: StockMovementsController;
  let service: StockMovementsService;

  const mockMovementsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    createManual: jest.fn(),
    remove: jest.fn(),
    findArchived: jest.fn(),
    restore: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockMovementsController],
      providers: [
        {
          provide: StockMovementsService,
          useValue: mockMovementsService,
        },
      ],
    }).compile();

    controller = module.get<StockMovementsController>(StockMovementsController);
    service = module.get<StockMovementsService>(StockMovementsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all movements', async () => {
      const businessId = 'business-123';
      const mockResult = {
        data: [
          {
            id: 'movement-1',
            type: StockMovementType.ENTREE_ACHAT,
            quantity: '10',
            quantity_before: '100',
            quantity_after: '110',
          },
        ],
        total: 1,
      };

      mockMovementsService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(businessId);

      expect(service.findAll).toHaveBeenCalledWith(businessId, undefined, undefined, 20, 0);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].quantity).toBe(10);
    });

    it('should filter by product_id and type', async () => {
      const businessId = 'business-123';
      const productId = 'product-123';
      const type = StockMovementType.SORTIE_VENTE;

      const mockResult = {
        data: [
          {
            id: 'movement-1',
            type: StockMovementType.SORTIE_VENTE,
            quantity: '5',
            quantity_before: '100',
            quantity_after: '95',
          },
        ],
        total: 1,
      };

      mockMovementsService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(businessId, productId, type);

      expect(service.findAll).toHaveBeenCalledWith(businessId, productId, type, 20, 0);
      expect(result.data[0].type).toBe(StockMovementType.SORTIE_VENTE);
    });
  });

  describe('findOne', () => {
    it('should return a movement by id', async () => {
      const businessId = 'business-123';
      const movementId = 'movement-123';
      const mockMovement = {
        id: movementId,
        type: StockMovementType.ENTREE_ACHAT,
        quantity: '10',
        quantity_before: '100',
        quantity_after: '110',
      };

      mockMovementsService.findOne.mockResolvedValue(mockMovement);

      const result = await controller.findOne(businessId, movementId);

      expect(service.findOne).toHaveBeenCalledWith(businessId, movementId);
      expect(result.quantity).toBe(10);
    });
  });

  describe('createManual', () => {
    it('should create a manual movement', async () => {
      const businessId = 'business-123';
      const dto = {
        product_id: 'product-123',
        type: StockMovementType.AJUSTEMENT_POSITIF,
        quantity: 5,
        reference: 'ADJ-001',
      };

      const mockMovement = {
        id: 'movement-123',
        business_id: businessId,
        ...dto,
        quantity: '5',
        quantity_before: '100',
        quantity_after: '105',
      };

      mockMovementsService.createManual.mockResolvedValue(mockMovement);

      const result = await controller.createManual(businessId, dto);

      expect(service.createManual).toHaveBeenCalledWith(businessId, dto);
      expect(result.quantity).toBe(5);
    });
  });

  describe('remove', () => {
    it('should remove a movement', async () => {
      const businessId = 'business-123';
      const movementId = 'movement-123';

      mockMovementsService.remove.mockResolvedValue({ message: 'Movement deleted' });

      const result = await controller.remove(businessId, movementId);

      expect(service.remove).toHaveBeenCalledWith(businessId, movementId);
      expect(result).toEqual({ message: 'Movement deleted' });
    });
  });

  describe('restore', () => {
    it('should restore a deleted movement', async () => {
      const businessId = 'business-123';
      const movementId = 'movement-123';

      const restoredMovement = {
        id: movementId,
        deleted_at: null,
      };

      mockMovementsService.restore.mockResolvedValue(restoredMovement);

      const result = await controller.restore(businessId, movementId);

      expect(service.restore).toHaveBeenCalledWith(businessId, movementId);
      expect(result).toEqual(restoredMovement);
    });
  });
});
