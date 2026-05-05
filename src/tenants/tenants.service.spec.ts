import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantsService } from './tenants.service';
import { Tenant } from './entities/tenant.entity';
import { BusinessMember } from '../businesses/entities/business-member.entity';
import { Business } from '../businesses/entities/business.entity';
import { NotFoundException } from '@nestjs/common';
import { Role } from '../users/enums/role.enum';

describe('TenantsService', () => {
  let service: TenantsService;
  let tenantRepository: Repository<Tenant>;

  const mockTenantRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockBusinessMemberRepository = {
    findOne: jest.fn(),
  };

  const mockBusinessRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
        {
          provide: getRepositoryToken(BusinessMember),
          useValue: mockBusinessMemberRepository,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository,
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    tenantRepository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a tenant', async () => {
      const dto = {
        name: 'Test Tenant',
        ownerId: 'user-123',
      };

      const mockTenant = {
        id: 'tenant-123',
        ...dto,
      };

      mockTenantRepository.create.mockReturnValue(mockTenant);
      mockTenantRepository.save.mockResolvedValue(mockTenant);

      const result = await service.create(dto);

      expect(tenantRepository.create).toHaveBeenCalledWith(dto);
      expect(tenantRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockTenant);
    });
  });

  describe('findById', () => {
    it('should return a tenant by id', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.findById('tenant-123');

      expect(tenantRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
      });
      expect(result).toEqual(mockTenant);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockTenantRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByOwnerId', () => {
    it('should return a tenant by owner id', async () => {
      const mockTenant = {
        id: 'tenant-123',
        ownerId: 'user-123',
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.findByOwnerId('user-123');

      expect(tenantRepository.findOne).toHaveBeenCalledWith({
        where: { ownerId: 'user-123' },
      });
      expect(result).toEqual(mockTenant);
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockTenantRepository.findOne.mockResolvedValue(null);

      await expect(service.findByOwnerId('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMyTenant', () => {
    it('should return tenant for BUSINESS_OWNER', async () => {
      const mockTenant = {
        id: 'tenant-123',
        ownerId: 'user-123',
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.findMyTenant('user-123', Role.BUSINESS_OWNER);

      expect(result).toEqual(mockTenant);
    });

    it('should return tenant for TEAM_MEMBER through business membership', async () => {
      const mockMembership = {
        user_id: 'user-456',
        business_id: 'business-123',
        business: { id: 'business-123', tenant_id: 'tenant-123' },
      };

      const mockBusiness = {
        id: 'business-123',
        tenant_id: 'tenant-123',
      };

      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
      };

      mockBusinessMemberRepository.findOne.mockResolvedValue(mockMembership);
      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.findMyTenant('user-456', Role.TEAM_MEMBER);

      expect(result).toEqual(mockTenant);
    });
  });

  describe('update', () => {
    it('should update a tenant', async () => {
      const dto = { name: 'Updated Tenant' };
      const mockTenant = {
        id: 'tenant-123',
        ...dto,
      };

      mockTenantRepository.update.mockResolvedValue({ affected: 1 });
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.update('tenant-123', dto);

      expect(tenantRepository.update).toHaveBeenCalledWith('tenant-123', dto);
      expect(result).toEqual(mockTenant);
    });
  });

  describe('checkOwnership', () => {
    it('should return true if user owns tenant', async () => {
      const mockTenant = {
        id: 'tenant-123',
        ownerId: 'user-123',
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.checkOwnership('tenant-123', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false if user does not own tenant', async () => {
      const mockTenant = {
        id: 'tenant-123',
        ownerId: 'user-123',
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.checkOwnership('tenant-123', 'user-456');

      expect(result).toBe(false);
    });
  });
});
