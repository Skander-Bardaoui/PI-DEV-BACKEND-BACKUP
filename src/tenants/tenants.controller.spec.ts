import { Test, TestingModule } from '@nestjs/testing';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { Role } from '../users/enums/role.enum';

describe('TenantsController', () => {
  let controller: TenantsController;
  let service: TenantsService;

  const mockTenantsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findMyTenant: jest.fn(),
    findByOwnerId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    uploadLogo: jest.fn(),
    checkOwnership: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      role: Role.BUSINESS_OWNER,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: mockTenantsService,
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    service = module.get<TenantsService>(TenantsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMy', () => {
    it('should return user tenant', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
        ownerId: 'user-123',
      };

      mockTenantsService.findMyTenant.mockResolvedValue(mockTenant);

      const result = await controller.getMy(mockRequest);

      expect(service.findMyTenant).toHaveBeenCalledWith('user-123', Role.BUSINESS_OWNER);
      expect(result).toEqual(mockTenant);
    });
  });

  describe('create', () => {
    it('should create a tenant', async () => {
      const dto = {
        name: 'New Tenant',
        ownerId: 'user-123',
      };

      const mockTenant = {
        id: 'tenant-123',
        ...dto,
      };

      mockTenantsService.create.mockResolvedValue(mockTenant);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTenant);
    });
  });

  describe('findAll', () => {
    it('should return paginated tenants', async () => {
      const query = { page: 1, limit: 20 };
      const mockResult = {
        tenants: [{ id: 'tenant-1', name: 'Tenant 1' }],
        total: 1,
      };

      mockTenantsService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual({
        ...mockResult,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('findOne', () => {
    it('should return a tenant by id', async () => {
      const tenantId = 'tenant-123';
      const mockTenant = { id: tenantId, name: 'Test Tenant' };

      mockTenantsService.findById.mockResolvedValue(mockTenant);
      mockTenantsService.checkOwnership.mockResolvedValue(true);

      const result = await controller.findOne(tenantId, mockRequest);

      expect(service.findById).toHaveBeenCalledWith(tenantId);
      expect(result).toEqual(mockTenant);
    });
  });

  describe('update', () => {
    it('should update a tenant', async () => {
      const tenantId = 'tenant-123';
      const dto = { name: 'Updated Tenant' };
      const mockTenant = { id: tenantId, ...dto };

      mockTenantsService.checkOwnership.mockResolvedValue(true);
      mockTenantsService.update.mockResolvedValue(mockTenant);

      const result = await controller.update(tenantId, dto, mockRequest);

      expect(service.update).toHaveBeenCalledWith(tenantId, dto);
      expect(result).toEqual(mockTenant);
    });
  });

  describe('delete', () => {
    it('should delete a tenant', async () => {
      const tenantId = 'tenant-123';

      mockTenantsService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(tenantId);

      expect(service.delete).toHaveBeenCalledWith(tenantId);
      expect(result).toEqual({ message: 'Tenant deleted successfully' });
    });
  });
});
