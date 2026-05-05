import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { StockMovementsService } from './stock-movements.service';
import { StockMovement } from '../../entities/stock-movement.entity';
import { Product, ProductType } from '../../entities/product.entity';
import { CreateStockMovementDto } from '../../dto/create-stock-movement.dto';
import { StockMovementType } from '../../enums/stock-movement-type.enum';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('StockMovementsService', () => {
  let service: StockMovementsService;
  let movementRepo: Repository<StockMovement>;
  let productRepo: Repository<Product>;

  const mockMovementRepository = {
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn(),
    })),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockProductRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockMovementsService,
        {
          provide: getRepositoryToken(StockMovement),
          useValue: mockMovementRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    service = module.get<StockMovementsService>(StockMovementsService);
    movementRepo = module.get<Repository<StockMovement>>(
      getRepositoryToken(StockMovement),
    );
    productRepo = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all stock movements for a business', async () => {
      const businessId = 'business-123';
      const mockMovements = [
        {
          id: 'movement-1',
          business_id: businessId,
          type: StockMovementType.IN,
          quantity: 10,
        },
        {
          id: 'movement-2',
          business_id: businessId,
          type: StockMovementType.OUT,
          quantity: -5,
        },
      ];

      const qb = mockMovementRepository.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([mockMovements, 2]);

      const result = await service.findAll(businessId);

      expect(result.data).toEqual(mockMovements);
      expect(result.total).toBe(2);
    });

    it('should filter by productId', async () => {
      const businessId = 'business-123';
      const productId = 'product-123';

      const qb = mockMovementRepository.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(businessId, productId);

      expect(qb.andWhere).toHaveBeenCalledWith('movement.product_id = :productId', {
        productId,
      });
    });

    it('should filter by type', async () => {
      const businessId = 'business-123';
      const type = StockMovementType.IN;

      const qb = mockMovementRepository.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(businessId, undefined, type);

      expect(qb.andWhere).toHaveBeenCalledWith('movement.type = :type', { type });
    });

    it('should apply pagination with limit and offset', async () => {
      const businessId = 'business-123';
      const limit = 50;
      const offset = 10;

      const qb = mockMovementRepository.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(businessId, undefined, undefined, limit, offset);

      expect(qb.take).toHaveBeenCalledWith(limit);
      expect(qb.skip).toHaveBeenCalledWith(offset);
    });

    it('should exclude soft-deleted movements', async () => {
      const businessId = 'business-123';

      const qb = mockMovementRepository.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(businessId);

      expect(qb.andWhere).toHaveBeenCalledWith('movement.deleted_at IS NULL');
    });
  });

  describe('findOne', () => {
    it('should return a stock movement by id', async () => {
      const businessId = 'business-123';
      const movementId = 'movement-123';
      const mockMovement = {
        id: movementId,
        business_id: businessId,
        type: StockMovementType.IN,
        quantity: 10,
      };

      mockMovementRepository.findOne.mockResolvedValue(mockMovement);

      const result = await service.findOne(businessId, movementId);

      expect(movementRepo.findOne).toHaveBeenCalledWith({
        where: { id: movementId, business_id: businessId, deleted_at: IsNull() },
        relations: ['product'],
      });
      expect(result).toEqual(mockMovement);
    });

    it('should throw NotFoundException if movement not found', async () => {
      mockMovementRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('business-123', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createManual', () => {
    it('should create a manual IN movement', async () => {
      const businessId = 'business-123';
      const dto: CreateStockMovementDto = {
        product_id: 'product-123',
        type: StockMovementType.IN,
        quantity: 10,
        note: 'Manual stock addition',
      };

      const mockProduct = {
        id: 'product-123',
        business_id: businessId,
        type: ProductType.PHYSICAL,
        quantity: 50,
      };

      const mockMovement = {
        id: 'movement-123',
        business_id: businessId,
        product_id: dto.product_id,
        type: dto.type,
        quantity: 10,
        quantity_before: 50,
        quantity_after: 60,
        reference_type: 'MANUAL',
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockMovementRepository.create.mockReturnValue(mockMovement);
      mockMovementRepository.save.mockResolvedValue(mockMovement);
      mockMovementRepository.findOne.mockResolvedValue(mockMovement);

      const result = await service.createManual(businessId, dto);

      expect(productRepo.findOne).toHaveBeenCalledWith({
        where: { id: dto.product_id, business_id: businessId },
      });
      expect(movementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: businessId,
          product_id: dto.product_id,
          type: dto.type,
          quantity: 10,
          quantity_before: 50,
          quantity_after: 60,
          reference_type: 'MANUAL',
        }),
      );
      expect(productRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 60 }),
      );
    });

    it('should create a manual OUT movement with negative quantity', async () => {
      const businessId = 'business-123';
      const dto: CreateStockMovementDto = {
        product_id: 'product-123',
        type: StockMovementType.OUT,
        quantity: 15,
        note: 'Manual stock removal',
      };

      const mockProduct = {
        id: 'product-123',
        business_id: businessId,
        type: ProductType.PHYSICAL,
        quantity: 50,
      };

      const mockMovement = {
        id: 'movement-123',
        quantity: -15,
        quantity_before: 50,
        quantity_after: 35,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockMovementRepository.create.mockReturnValue(mockMovement);
      mockMovementRepository.save.mockResolvedValue(mockMovement);
      mockMovementRepository.findOne.mockResolvedValue(mockMovement);

      await service.createManual(businessId, dto);

      expect(movementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: -15,
          quantity_before: 50,
          quantity_after: 35,
        }),
      );
      expect(productRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 35 }),
      );
    });

    it('should create ENTREE_ACHAT movement', async () => {
      const businessId = 'business-123';
      const dto: CreateStockMovementDto = {
        product_id: 'product-123',
        type: StockMovementType.ENTREE_ACHAT,
        quantity: 20,
      };

      const mockProduct = {
        id: 'product-123',
        type: ProductType.PHYSICAL,
        quantity: 100,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockMovementRepository.create.mockReturnValue({});
      mockMovementRepository.save.mockResolvedValue({});
      mockMovementRepository.findOne.mockResolvedValue({});

      await service.createManual(businessId, dto);

      expect(movementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 20,
          quantity_after: 120,
        }),
      );
    });

    it('should create SORTIE_VENTE movement', async () => {
      const businessId = 'business-123';
      const dto: CreateStockMovementDto = {
        product_id: 'product-123',
        type: StockMovementType.SORTIE_VENTE,
        quantity: 10,
      };

      const mockProduct = {
        id: 'product-123',
        type: ProductType.PHYSICAL,
        quantity: 100,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockMovementRepository.create.mockReturnValue({});
      mockMovementRepository.save.mockResolvedValue({});
      mockMovementRepository.findOne.mockResolvedValue({});

      await service.createManual(businessId, dto);

      expect(movementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: -10,
          quantity_after: 90,
        }),
      );
    });

    it('should create AJUSTEMENT_POSITIF movement', async () => {
      const businessId = 'business-123';
      const dto: CreateStockMovementDto = {
        product_id: 'product-123',
        type: StockMovementType.AJUSTEMENT_POSITIF,
        quantity: 5,
      };

      const mockProduct = {
        id: 'product-123',
        type: ProductType.PHYSICAL,
        quantity: 50,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockMovementRepository.create.mockReturnValue({});
      mockMovementRepository.save.mockResolvedValue({});
      mockMovementRepository.findOne.mockResolvedValue({});

      await service.createManual(businessId, dto);

      expect(movementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 5,
          quantity_after: 55,
        }),
      );
    });

    it('should create AJUSTEMENT_NEGATIF movement', async () => {
      const businessId = 'business-123';
      const dto: CreateStockMovementDto = {
        product_id: 'product-123',
        type: StockMovementType.AJUSTEMENT_NEGATIF,
        quantity: 5,
      };

      const mockProduct = {
        id: 'product-123',
        type: ProductType.PHYSICAL,
        quantity: 50,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockMovementRepository.create.mockReturnValue({});
      mockMovementRepository.save.mockResolvedValue({});
      mockMovementRepository.findOne.mockResolvedValue({});

      await service.createManual(businessId, dto);

      expect(movementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: -5,
          quantity_after: 45,
        }),
      );
    });

    it('should throw NotFoundException if product not found', async () => {
      const dto: CreateStockMovementDto = {
        product_id: 'non-existent',
        type: StockMovementType.IN,
        quantity: 10,
      };

      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.createManual('business-123', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for SERVICE products', async () => {
      const dto: CreateStockMovementDto = {
        product_id: 'product-123',
        type: StockMovementType.IN,
        quantity: 10,
      };

      const mockProduct = {
        id: 'product-123',
        type: ProductType.SERVICE,
        quantity: 0,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      await expect(service.createManual('business-123', dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createManual('business-123', dto)).rejects.toThrow(
        'Stock movements cannot be created for service or digital products.',
      );
    });

    it('should throw BadRequestException for DIGITAL products', async () => {
      const dto: CreateStockMovementDto = {
        product_id: 'product-123',
        type: StockMovementType.IN,
        quantity: 10,
      };

      const mockProduct = {
        id: 'product-123',
        type: ProductType.DIGITAL,
        quantity: 0,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      await expect(service.createManual('business-123', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include warehouse_id if provided', async () => {
      const dto: CreateStockMovementDto = {
        product_id: 'product-123',
        type: StockMovementType.IN,
        quantity: 10,
        warehouse_id: 'warehouse-123',
      };

      const mockProduct = {
        id: 'product-123',
        type: ProductType.PHYSICAL,
        quantity: 50,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockMovementRepository.create.mockReturnValue({});
      mockMovementRepository.save.mockResolvedValue({});
      mockMovementRepository.findOne.mockResolvedValue({});

      await service.createManual('business-123', dto);

      expect(movementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouse_id: 'warehouse-123',
        }),
      );
    });

    it('should include source_type and source_id if provided', async () => {
      const dto: CreateStockMovementDto = {
        product_id: 'product-123',
        type: StockMovementType.IN,
        quantity: 10,
        source_type: 'PURCHASE_ORDER',
        source_id: 'po-123',
      };

      const mockProduct = {
        id: 'product-123',
        type: ProductType.PHYSICAL,
        quantity: 50,
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockMovementRepository.create.mockReturnValue({});
      mockMovementRepository.save.mockResolvedValue({});
      mockMovementRepository.findOne.mockResolvedValue({});

      await service.createManual('business-123', dto);

      expect(movementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reference_type: 'PURCHASE_ORDER',
          reference_id: 'po-123',
        }),
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a manual movement and reverse product quantity', async () => {
      const businessId = 'business-123';
      const movementId = 'movement-123';

      const mockMovement = {
        id: movementId,
        business_id: businessId,
        product_id: 'product-123',
        reference_type: 'MANUAL',
        quantity: 10,
        deleted_at: null,
      };

      const mockProduct = {
        id: 'product-123',
        quantity: 60,
      };

      mockMovementRepository.findOne.mockResolvedValue(mockMovement);
      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockMovementRepository.save.mockResolvedValue({
        ...mockMovement,
        deleted_at: expect.any(Date),
      });

      await service.remove(businessId, movementId);

      expect(productRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 50 }),
      );
      expect(movementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(Date) }),
      );
    });

    it('should throw error when trying to delete non-manual movement', async () => {
      const mockMovement = {
        id: 'movement-123',
        reference_type: 'PURCHASE_ORDER',
        quantity: 10,
      };

      mockMovementRepository.findOne.mockResolvedValue(mockMovement);

      await expect(service.remove('business-123', 'movement-123')).rejects.toThrow(
        'Only manual movements can be deleted',
      );
    });
  });

  describe('findArchived', () => {
    it('should return soft-deleted movements', async () => {
      const businessId = 'business-123';
      const mockArchivedMovements = [
        {
          id: 'movement-1',
          business_id: businessId,
          deleted_at: new Date(),
        },
        {
          id: 'movement-2',
          business_id: businessId,
          deleted_at: new Date(),
        },
      ];

      const qb = mockMovementRepository.createQueryBuilder();
      qb.getMany.mockResolvedValue(mockArchivedMovements);

      const result = await service.findArchived(businessId);

      expect(qb.andWhere).toHaveBeenCalledWith('movement.deleted_at IS NOT NULL');
      expect(result).toEqual(mockArchivedMovements);
    });
  });

  describe('restore', () => {
    it('should restore a soft-deleted movement', async () => {
      const businessId = 'business-123';
      const movementId = 'movement-123';

      const mockDeletedMovement = {
        id: movementId,
        business_id: businessId,
        deleted_at: new Date(),
      };

      const mockRestoredMovement = {
        ...mockDeletedMovement,
        deleted_at: null,
      };

      const qb = mockMovementRepository.createQueryBuilder();
      qb.getOne.mockResolvedValue(mockDeletedMovement);
      mockMovementRepository.save.mockResolvedValue(mockRestoredMovement);
      mockMovementRepository.findOne.mockResolvedValue(mockRestoredMovement);

      const result = await service.restore(businessId, movementId);

      expect(movementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: null }),
      );
      expect(result).toEqual(mockRestoredMovement);
    });

    it('should throw NotFoundException if movement not found', async () => {
      const qb = mockMovementRepository.createQueryBuilder();
      qb.getOne.mockResolvedValue(null);

      await expect(service.restore('business-123', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if movement is not deleted', async () => {
      const mockActiveMovement = {
        id: 'movement-123',
        business_id: 'business-123',
        deleted_at: null,
      };

      const qb = mockMovementRepository.createQueryBuilder();
      qb.getOne.mockResolvedValue(mockActiveMovement);

      await expect(service.restore('business-123', 'movement-123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.restore('business-123', 'movement-123')).rejects.toThrow(
        'Stock movement is not deleted',
      );
    });
  });
});
