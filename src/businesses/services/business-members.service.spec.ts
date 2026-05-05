import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessMembersService } from './business-members.service';
import { BusinessMember } from '../entities/business-member.entity';
import { Business } from '../entities/business.entity';
import { User } from '../../users/entities/user.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Role } from '../../users/enums/role.enum';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PermissionUtil } from '../utils/permission.util';

jest.mock('../utils/permission.util');

describe('BusinessMembersService', () => {
  let service: BusinessMembersService;
  let memberRepo: Repository<BusinessMember>;
  let businessRepo: Repository<Business>;
  let userRepo: Repository<User>;

  const mockMemberRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockBusinessRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockTenantRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessMembersService,
        {
          provide: getRepositoryToken(BusinessMember),
          useValue: mockMemberRepository,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    service = module.get<BusinessMembersService>(BusinessMembersService);
    memberRepo = module.get<Repository<BusinessMember>>(getRepositoryToken(BusinessMember));
    businessRepo = module.get<Repository<Business>>(getRepositoryToken(Business));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserBusinesses', () => {
    it('should return all businesses for PLATFORM_ADMIN', async () => {
      const mockUser = {
        id: 'user-123',
        role: Role.PLATFORM_ADMIN,
      };

      const mockBusinesses = [
        { id: 'business-1', name: 'Business 1' },
        { id: 'business-2', name: 'Business 2' },
      ];

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockBusinessRepository.find.mockResolvedValue(mockBusinesses);

      const result = await service.getUserBusinesses('user-123');

      expect(businessRepo.find).toHaveBeenCalled();
      expect(result).toEqual(mockBusinesses);
    });

    it('should return tenant businesses for BUSINESS_OWNER', async () => {
      const mockUser = {
        id: 'user-123',
        role: Role.BUSINESS_OWNER,
      };

      const mockTenant = {
        id: 'tenant-123',
        ownerId: 'user-123',
      };

      const mockBusinesses = [
        { id: 'business-1', tenant_id: 'tenant-123' },
      ];

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockBusinessRepository.find.mockResolvedValue(mockBusinesses);

      const result = await service.getUserBusinesses('user-123');

      expect(result).toEqual(mockBusinesses);
    });

    it('should return member businesses for other roles', async () => {
      const mockUser = {
        id: 'user-123',
        role: Role.TEAM_MEMBER,
      };

      const mockMemberships = [
        {
          user_id: 'user-123',
          business_id: 'business-1',
          business: { id: 'business-1', name: 'Business 1' },
        },
      ];

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockMemberRepository.find.mockResolvedValue(mockMemberships);

      const result = await service.getUserBusinesses('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('business-1');
    });
  });

  describe('addMember', () => {
    it('should add a member to business', async () => {
      const mockBusiness = {
        id: 'business-123',
        name: 'Test Business',
      };

      const mockUser = {
        id: 'user-456',
        email: 'test@example.com',
      };

      const mockInviter = {
        id: 'user-123',
        email: 'inviter@example.com',
      };

      const mockMember = {
        id: 'member-123',
        business_id: 'business-123',
        user_id: 'user-456',
        role: Role.TEAM_MEMBER,
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockInviter);
      mockMemberRepository.findOne.mockResolvedValue(null);
      mockMemberRepository.create.mockReturnValue(mockMember);
      mockMemberRepository.save.mockResolvedValue(mockMember);

      (PermissionUtil.getRoleDefaultCollaborationPermissions as jest.Mock).mockReturnValue({});
      (PermissionUtil.getRoleDefaultStockPermissions as jest.Mock).mockReturnValue({});
      (PermissionUtil.getRoleDefaultPaymentPermissions as jest.Mock).mockReturnValue({});

      const result = await service.addMember('business-123', 'user-456', Role.TEAM_MEMBER, 'user-123');

      expect(memberRepo.create).toHaveBeenCalled();
      expect(memberRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockMember);
    });

    it('should throw BadRequestException if user is already a member', async () => {
      const mockBusiness = {
        id: 'business-123',
      };

      const mockUser = {
        id: 'user-456',
      };

      const mockInviter = {
        id: 'user-123',
      };

      const existingMember = {
        business_id: 'business-123',
        user_id: 'user-456',
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockInviter);
      mockMemberRepository.findOne.mockResolvedValue(existingMember);

      await expect(
        service.addMember('business-123', 'user-456', Role.TEAM_MEMBER, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const mockBusiness = {
        id: 'business-123',
      };

      const mockMember = {
        id: 'member-123',
        business_id: 'business-123',
        user_id: 'user-456',
        role: Role.TEAM_MEMBER,
        is_active: true,
        collaboration_permissions: {},
        stock_permissions: {},
        payment_permissions: {},
      };

      const updatedMember = {
        ...mockMember,
        role: Role.BUSINESS_ADMIN,
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockMemberRepository.findOne.mockResolvedValue(mockMember);
      mockMemberRepository.save.mockResolvedValue(updatedMember);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateMemberRole('business-123', 'user-456', Role.BUSINESS_ADMIN);

      expect(memberRepo.save).toHaveBeenCalled();
      expect(userRepo.update).toHaveBeenCalledWith('user-456', { role: Role.BUSINESS_ADMIN });
      expect(result.role).toBe(Role.BUSINESS_ADMIN);
    });

    it('should set full permissions when promoting to BUSINESS_OWNER', async () => {
      const mockBusiness = {
        id: 'business-123',
      };

      const mockMember = {
        id: 'member-123',
        business_id: 'business-123',
        user_id: 'user-456',
        role: Role.TEAM_MEMBER,
        is_active: true,
        collaboration_permissions: {},
        stock_permissions: {},
        payment_permissions: {},
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockMemberRepository.findOne.mockResolvedValue(mockMember);
      mockMemberRepository.save.mockResolvedValue(mockMember);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      (PermissionUtil.getRoleDefaultCollaborationPermissions as jest.Mock).mockReturnValue({
        create_task: true,
        update_task: true,
        delete_task: true,
      });

      await service.updateMemberRole('business-123', 'user-456', Role.BUSINESS_OWNER);

      expect(memberRepo.save).toHaveBeenCalled();
    });
  });

  describe('updateMemberPermissions', () => {
    it('should update member permissions', async () => {
      const mockBusiness = {
        id: 'business-123',
      };

      const mockMember = {
        id: 'member-123',
        business_id: 'business-123',
        user_id: 'user-456',
        role: Role.TEAM_MEMBER,
        is_active: true,
        collaboration_permissions: {},
      };

      const newPermissions = {
        create_task: true,
        update_task: true,
      };

      const updatedMember = {
        ...mockMember,
        collaboration_permissions: newPermissions,
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockMemberRepository.findOne.mockResolvedValue(mockMember);
      mockMemberRepository.save.mockResolvedValue(updatedMember);

      const result = await service.updateMemberPermissions(
        'business-123',
        'user-456',
        newPermissions,
      );

      expect(memberRepo.save).toHaveBeenCalled();
      expect(result.collaboration_permissions).toEqual(newPermissions);
    });

    it('should throw ForbiddenException when trying to modify BUSINESS_OWNER permissions', async () => {
      const mockBusiness = {
        id: 'business-123',
      };

      const mockMember = {
        id: 'member-123',
        business_id: 'business-123',
        user_id: 'user-456',
        role: Role.BUSINESS_OWNER,
        is_active: true,
      };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockMemberRepository.findOne.mockResolvedValue(mockMember);

      await expect(
        service.updateMemberPermissions('business-123', 'user-456', { create_task: false }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('hasAccess', () => {
    it('should return true for PLATFORM_ADMIN', async () => {
      const mockUser = {
        id: 'user-123',
        role: Role.PLATFORM_ADMIN,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasAccess('user-123', 'business-123');

      expect(result).toBe(true);
    });

    it('should return true for active member', async () => {
      const mockUser = {
        id: 'user-123',
        role: Role.TEAM_MEMBER,
      };

      const mockMember = {
        business_id: 'business-123',
        user_id: 'user-123',
        is_active: true,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockMemberRepository.findOne.mockResolvedValue(mockMember);

      const result = await service.hasAccess('user-123', 'business-123');

      expect(result).toBe(true);
    });

    it('should return false for non-member', async () => {
      const mockUser = {
        id: 'user-123',
        role: Role.TEAM_MEMBER,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockMemberRepository.findOne.mockResolvedValue(null);

      const result = await service.hasAccess('user-123', 'business-123');

      expect(result).toBe(false);
    });
  });
});
