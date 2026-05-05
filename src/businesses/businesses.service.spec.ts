import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessesService } from './businesses.service';
import { Business } from './entities/business.entity';
import { BusinessSettings } from './entities/business-settings.entity';
import { TaxRate } from './entities/tax-rate.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { NotFoundException } from '@nestjs/common';

describe('BusinessesService', () => {
  let service: BusinessesService;
  let businessRepository: Repository<Business>;
  let settingsRepository: Repository<BusinessSettings>;
  let taxRateRepository: Repository<TaxRate>;

  const mockBusinessRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockSettingsRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockTaxRateRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTenantRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessesService,
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository,
        },
        {
          provide: getRepositoryToken(BusinessSettings),
          useValue: mockSettingsRepository,
        },
        {
          provide: getRepositoryToken(TaxRate),
          useValue: mockTaxRateRepository,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    service = module.get<BusinessesService>(BusinessesService);
    businessRepository = module.get<Repository<Business>>(getRepositoryToken(Business));
    settingsRepository = module.get<Repository<BusinessSettings>>(getRepositoryToken(BusinessSettings));
    taxRateRepository = module.get<Repository<TaxRate>>(getRepositoryToken(TaxRate));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a business with default settings', async () => {
      const dto = {
        name: 'Test Business',
        industry: 'Technology',
        tenant_id: 'tenant-123',
      };

      const mockBusiness = {
        id: 'business-123',
        ...dto,
        currency: 'TND',
      };

      mockBusinessRepository.create.mockReturnValue(mockBusiness);
      mockBusinessRepository.save.mockResolvedValue(mockBusiness);
      mockSettingsRepository.save.mockResolvedValue({});

      const result = await service.create(dto);

      expect(businessRepository.create).toHaveBeenCalled();
      expect(businessRepository.save).toHaveBeenCalled();
      expect(settingsRepository.save).toHaveBeenCalledWith({
        business_id: 'business-123',
        invoice_prefix: 'INV-',
        payment_terms: 30,
      });
      expect(result).toEqual(mockBusiness);
    });
  });

  describe('findById', () => {
    it('should return a business by id', async () => {
      const mockBusiness = {
        id: 'business-123',
        name: 'Test Business',
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);

      const result = await service.findById('business-123');

      expect(businessRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'business-123' },
        relations: ['tenant'],
      });
      expect(result).toEqual(mockBusiness);
    });

    it('should throw NotFoundException if business not found', async () => {
      mockBusinessRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a business', async () => {
      const dto = { name: 'Updated Business' };
      const mockBusiness = {
        id: 'business-123',
        ...dto,
      };

      mockBusinessRepository.update.mockResolvedValue({ affected: 1 });
      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);

      const result = await service.update('business-123', dto);

      expect(businessRepository.update).toHaveBeenCalledWith('business-123', dto);
      expect(result).toEqual(mockBusiness);
    });
  });

  describe('delete', () => {
    it('should delete a business', async () => {
      mockBusinessRepository.delete.mockResolvedValue({ affected: 1 });

      await service.delete('business-123');

      expect(businessRepository.delete).toHaveBeenCalledWith('business-123');
    });

    it('should throw NotFoundException if business not found', async () => {
      mockBusinessRepository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTaxRates', () => {
    it('should return tax rates for a business', async () => {
      const mockTaxRates = [
        { id: 'tax-1', name: 'TVA 19%', rate: 19, is_default: true },
        { id: 'tax-2', name: 'TVA 7%', rate: 7, is_default: false },
      ];

      mockTaxRateRepository.find.mockResolvedValue(mockTaxRates);

      const result = await service.getTaxRates('business-123');

      expect(taxRateRepository.find).toHaveBeenCalledWith({
        where: { business_id: 'business-123' },
        order: { is_default: 'DESC', created_at: 'DESC' },
      });
      expect(result).toEqual(mockTaxRates);
    });
  });
});
