import { Test, TestingModule } from '@nestjs/testing';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { BusinessMembersService } from './services/business-members.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Role } from '../users/enums/role.enum';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

describe('BusinessesController', () => {
  let controller: BusinessesController;
  let businessesService: BusinessesService;
  let businessMembersService: BusinessMembersService;

  const mockBusinessesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    createTaxRate: jest.fn(),
    getTaxRates: jest.fn(),
    updateTaxRate: jest.fn(),
    deleteTaxRate: jest.fn(),
  };

  const mockBusinessMembersService = {
    getUserBusinesses: jest.fn(),
    getBusinessMembers: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    updateMemberRole: jest.fn(),
    updateMemberPermissions: jest.fn(),
    getBusinessMemberDetails: jest.fn(),
    seedExistingMembersWithDefaultPermissions: jest.fn(),
  };

  const mockTenantRepository = {
    findOne: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      role: Role.BUSINESS_OWNER,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessesController],
      providers: [
        {
          provide: BusinessesService,
          useValue: mockBusinessesService,
        },
        {
          provide: BusinessMembersService,
          useValue: mockBusinessMembersService,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    controller = module.get<BusinessesController>(BusinessesController);
    businessesService = module.get<BusinessesService>(BusinessesService);
    businessMembersService = module.get<BusinessMembersService>(BusinessMembersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyBusinesses', () => {
    it('should return user businesses', async () => {
      const expectedBusinesses = [
        { id: 'business-1', name: 'Business 1' },
        { id: 'business-2', name: 'Business 2' },
      ];

      mockBusinessMembersService.getUserBusinesses.mockResolvedValue(expectedBusinesses);

      const result = await controller.getMyBusinesses(mockRequest);

      expect(businessMembersService.getUserBusinesses).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(expectedBusinesses);
    });
  });

  describe('create', () => {
    it('should create a business for BUSINESS_OWNER', async () => {
      const dto: CreateBusinessDto = {
        name: 'Test Business',
        industry: 'Technology',
        currency: 'TND',
      };

      const mockTenant = {
        id: 'tenant-123',
        logoUrl: 'https://example.com/logo.png',
      };

      const expectedBusiness = {
        id: 'business-123',
        ...dto,
        tenant_id: 'tenant-123',
        logo: 'https://example.com/logo.png',
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockBusinessesService.create.mockResolvedValue(expectedBusiness);
      mockBusinessMembersService.addMember.mockResolvedValue({});

      const result = await controller.create(dto, mockRequest);

      expect(businessesService.create).toHaveBeenCalled();
      expect(businessMembersService.addMember).toHaveBeenCalledWith(
        'business-123',
        'user-123',
        Role.BUSINESS_OWNER,
        'user-123',
      );
      expect(result).toEqual(expectedBusiness);
    });
  });

  describe('findAll', () => {
    it('should return paginated businesses', async () => {
      const query = { page: 1, limit: 20 };
      const expectedResult = {
        businesses: [{ id: 'business-1', name: 'Business 1' }],
        total: 1,
      };

      mockBusinessesService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query, mockRequest);

      expect(businessesService.findAll).toHaveBeenCalledWith(1, 20, undefined);
      expect(result).toEqual({
        ...expectedResult,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('findOne', () => {
    it('should return a business by id', async () => {
      const businessId = 'business-123';
      const expectedBusiness = { id: businessId, name: 'Test Business' };

      mockBusinessesService.findById.mockResolvedValue(expectedBusiness);

      const result = await controller.findOne(businessId);

      expect(businessesService.findById).toHaveBeenCalledWith(businessId);
      expect(result).toEqual(expectedBusiness);
    });
  });

  describe('update', () => {
    it('should update a business', async () => {
      const businessId = 'business-123';
      const dto: UpdateBusinessDto = { name: 'Updated Business' };
      const expectedBusiness = { id: businessId, ...dto };

      mockBusinessesService.update.mockResolvedValue(expectedBusiness);

      const result = await controller.update(businessId, dto);

      expect(businessesService.update).toHaveBeenCalledWith(businessId, dto);
      expect(result).toEqual(expectedBusiness);
    });
  });

  describe('delete', () => {
    it('should delete a business', async () => {
      const businessId = 'business-123';

      mockBusinessesService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(businessId);

      expect(businessesService.delete).toHaveBeenCalledWith(businessId);
      expect(result).toEqual({ message: 'Business deleted successfully' });
    });
  });

  describe('getMembers', () => {
    it('should return business members', async () => {
      const businessId = 'business-123';
      const expectedMembers = [
        { user_id: 'user-1', role: Role.BUSINESS_ADMIN },
        { user_id: 'user-2', role: Role.TEAM_MEMBER },
      ];

      mockBusinessMembersService.getBusinessMembers.mockResolvedValue(expectedMembers);

      const result = await controller.getMembers(businessId);

      expect(businessMembersService.getBusinessMembers).toHaveBeenCalledWith(businessId);
      expect(result).toEqual(expectedMembers);
    });
  });

  describe('addMember', () => {
    it('should add a member to business', async () => {
      const businessId = 'business-123';
      const body = { userId: 'user-456', role: Role.TEAM_MEMBER };
      const expectedMember = { user_id: 'user-456', role: Role.TEAM_MEMBER };

      mockBusinessMembersService.addMember.mockResolvedValue(expectedMember);

      const result = await controller.addMember(businessId, body, mockRequest);

      expect(businessMembersService.addMember).toHaveBeenCalledWith(
        businessId,
        'user-456',
        Role.TEAM_MEMBER,
        'user-123',
      );
      expect(result).toEqual(expectedMember);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const businessId = 'business-123';
      const userId = 'user-456';
      const body = { role: Role.BUSINESS_ADMIN };
      const expectedMember = { user_id: userId, role: Role.BUSINESS_ADMIN };

      mockBusinessMembersService.updateMemberRole.mockResolvedValue(expectedMember);

      const result = await controller.updateMemberRole(businessId, userId, body);

      expect(businessMembersService.updateMemberRole).toHaveBeenCalledWith(
        businessId,
        userId,
        Role.BUSINESS_ADMIN,
      );
      expect(result).toEqual(expectedMember);
    });
  });
});
